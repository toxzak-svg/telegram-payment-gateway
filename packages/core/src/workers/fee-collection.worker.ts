import 'dotenv/config';
import { Pool } from 'pg';
import { FeeService } from '../services/fee.service';
import TonBlockchainService from '../services/ton-blockchain.service';

/**
 * Fee Collection Worker
 * Automatically collects platform fees when threshold is reached
 * Runs periodically to sweep pending fees to platform wallet
 */
class FeeCollectionWorker {
  private pool: Pool;
  private feeService: FeeService;
  private tonService: TonBlockchainService;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  
  // Configuration
  private readonly CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private readonly MIN_COLLECTION_AMOUNT_TON = 1.0; // Minimum 1 TON before collection
  private readonly GAS_RESERVE_TON = 0.1; // Reserve for gas fees

  constructor(
    pool: Pool,
    feeService: FeeService,
    tonService: TonBlockchainService
  ) {
    this.pool = pool;
    this.feeService = feeService;
    this.tonService = tonService;
  }

  /**
   * Start the fee collection worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Fee collection worker already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Fee collection worker started');
    console.log(`⏰ Check interval: ${this.CHECK_INTERVAL_MS / 1000}s`);
    console.log(`💰 Min collection amount: ${this.MIN_COLLECTION_AMOUNT_TON} TON`);

    // Run immediately on start
    await this.collectFeesIfNeeded();

    // Schedule periodic checks
    this.intervalId = setInterval(
      () => this.collectFeesIfNeeded(),
      this.CHECK_INTERVAL_MS
    );
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('🛑 Fee collection worker stopped');
  }

  /**
   * Check pending fees and collect if threshold reached
   */
  private async collectFeesIfNeeded(): Promise<void> {
    try {
      console.log('\n🔍 Checking pending fees...');

      // Get pending fees
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as fee_count,
          COALESCE(SUM(fee_amount_ton), 0) as total_ton,
          COALESCE(SUM(fee_amount_usd), 0) as total_usd,
          array_agg(id) as fee_ids
        FROM platform_fees 
        WHERE status = 'pending'
        AND fee_amount_ton IS NOT NULL
        AND fee_amount_ton > 0
      `);

      const pendingData = result.rows[0];
      const totalTon = parseFloat(pendingData.total_ton);
      const feeCount = parseInt(pendingData.fee_count);
      const feeIds = pendingData.fee_ids;

      console.log(`📊 Pending fees: ${feeCount} fees, ${totalTon.toFixed(4)} TON`);

      // Check if we should collect
      if (totalTon < this.MIN_COLLECTION_AMOUNT_TON) {
        console.log(`⏸️ Below threshold (${this.MIN_COLLECTION_AMOUNT_TON} TON), skipping collection`);
        return;
      }

      // Get platform wallet address
      const platformWallet = await this.feeService.getPlatformWallet();
      
      if (!platformWallet) {
        console.error('❌ Platform wallet not configured');
        return;
      }

      console.log(`💸 Collecting ${totalTon.toFixed(4)} TON to ${platformWallet}`);

      // Create collection record
      const collectionResult = await this.pool.query(`
        INSERT INTO fee_collections (
          user_id, 
          fee_ids, 
          target_address, 
          total_fees_stars, 
          total_fees_ton, 
          total_fees_usd, 
          fees_collected, 
          status,
          created_at
        )
        SELECT 
          (SELECT id FROM users WHERE is_active = true LIMIT 1),
          $1,
          $2,
          COALESCE(SUM(fee_amount_stars), 0),
          COALESCE(SUM(fee_amount_ton), 0),
          COALESCE(SUM(fee_amount_usd), 0),
          COUNT(*),
          'processing',
          NOW()
        FROM platform_fees
        WHERE id = ANY($1)
        RETURNING id, total_fees_ton
      `, [feeIds, platformWallet]);

      const collectionId = collectionResult.rows[0].id;
      const amountToSend = parseFloat(collectionResult.rows[0].total_fees_ton) - this.GAS_RESERVE_TON;

      if (amountToSend <= 0) {
        console.error('❌ Amount too small after gas reserve');
        await this.markCollectionFailed(collectionId, 'Amount too small after gas reserve');
        return;
      }

      console.log(`🔐 Sending ${amountToSend.toFixed(4)} TON (${this.GAS_RESERVE_TON} TON reserved for gas)`);

      // Send TON to platform wallet
      try {
        const txHash = await this.tonService.sendTON(
          platformWallet,
          amountToSend,
          'Platform fee collection'
        );

        console.log(`✅ Transaction sent: ${txHash}`);

        // Mark as collected
        await this.markCollectionCompleted(collectionId, txHash, feeIds);

        console.log(`🎉 Successfully collected ${amountToSend.toFixed(4)} TON from ${feeCount} fees`);
      } catch (txError: any) {
        console.error('❌ Transaction failed:', txError.message);
        await this.markCollectionFailed(collectionId, txError.message);
      }

    } catch (error: any) {
      console.error('❌ Fee collection error:', error);
    }
  }

  /**
   * Mark collection as completed
   */
  private async markCollectionCompleted(
    collectionId: string,
    txHash: string,
    feeIds: string[]
  ): Promise<void> {
    await this.pool.query(`
      UPDATE fee_collections 
      SET status = 'completed', 
          tx_hash = $1, 
          collected_at = NOW()
      WHERE id = $2
    `, [txHash, collectionId]);

    await this.pool.query(`
      UPDATE platform_fees 
      SET status = 'collected', 
          collection_tx_hash = $1, 
          collected_at = NOW(),
          updated_at = NOW()
      WHERE id = ANY($2)
    `, [txHash, feeIds]);
  }

  /**
   * Mark collection as failed
   */
  private async markCollectionFailed(
    collectionId: string,
    errorMessage: string
  ): Promise<void> {
    await this.pool.query(`
      UPDATE fee_collections 
      SET status = 'failed', 
          error_message = $1
      WHERE id = $2
    `, [errorMessage, collectionId]);
  }
}

/**
 * Bootstrap and start the worker
 */
async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  if (!process.env.TON_WALLET_MNEMONIC) {
    throw new Error('TON_WALLET_MNEMONIC is required for fee collection');
  }

  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 5
  });

  const feeService = new FeeService(pool);
  
  const tonService = new TonBlockchainService(
    process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
    process.env.TON_API_KEY,
    process.env.TON_WALLET_MNEMONIC
  );

  const worker = new FeeCollectionWorker(pool, feeService, tonService);

  await worker.start();

  const shutdown = async () => {
    console.log('\n🛑 Shutting down fee collection worker...');
    await worker.stop();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Only run if executed directly
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Failed to start fee collection worker:', err);
    process.exit(1);
  });
}

export default FeeCollectionWorker;
