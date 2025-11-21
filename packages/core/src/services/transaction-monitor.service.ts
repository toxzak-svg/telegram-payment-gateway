import { IDatabase } from 'pg-promise';
import TonBlockchainService from './ton-blockchain.service';

export class TransactionMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private db: IDatabase<any>,
    private tonService: TonBlockchainService
  ) {}

  async start(intervalMs: number = 10000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 Transaction Monitor Service started');

    // Initial run
    await this.checkPendingTransactions();

    this.intervalId = setInterval(() => {
      this.checkPendingTransactions();
    }, intervalMs);
  }

  async stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Transaction Monitor Service stopped');
  }

  private async checkPendingTransactions() {
    try {
      // Find conversions that are submitted to DEX but not yet confirmed
      const pendingConversions = await this.db.any(
        `SELECT * FROM conversions 
         WHERE status IN ('phase2_committed', 'ton_pending') 
         AND (dex_tx_hash IS NOT NULL OR ton_tx_hash IS NOT NULL)`
      );

      for (const conversion of pendingConversions) {
        await this.checkConversionStatus(conversion);
      }
    } catch (error) {
      console.error('Error in transaction monitor loop:', error);
    }
  }

  private async checkConversionStatus(conversion: any) {
    const txHash = conversion.dex_tx_hash || conversion.ton_tx_hash;
    if (!txHash) return;

    try {
      const tx = await this.tonService.getTransaction(txHash);

      if (tx && tx.confirmed && tx.success) {
        console.log(`✅ Transaction confirmed: ${txHash} for conversion ${conversion.id}`);
        
        await this.db.tx(async t => {
            await t.none(
                `UPDATE conversions 
                 SET status = 'completed', ton_tx_hash = $1, 
                     completed_at = NOW(), updated_at = NOW()
                 WHERE id = $2`,
                [tx.hash, conversion.id]
            );
            
            // Mark fee as collected if exists
            const fee = await t.oneOrNone('SELECT id FROM platform_fees WHERE conversion_id = $1', [conversion.id]);
            if (fee) {
                await t.none(
                    `UPDATE platform_fees 
                     SET status = 'collected', collection_tx_hash = $1, collected_at = NOW(), updated_at = NOW() 
                     WHERE id = $2`,
                    [tx.hash, fee.id]
                );
            }
        });

      } else if (tx && tx.confirmed && !tx.success) {
        console.error(`❌ Transaction failed: ${txHash} for conversion ${conversion.id}`);
        await this.db.none(
          `UPDATE conversions 
           SET status = 'failed', error_message = $1, updated_at = NOW()
           WHERE id = $2`,
          [`Transaction failed on-chain (exit code: ${tx.exitCode})`, conversion.id]
        );
      }
    } catch (error) {
      console.error(`Error checking tx ${txHash}:`, error);
    }
  }
import { Pool } from 'pg';

/**
 * Transaction Monitor Service
 * Monitors pending transactions and updates their status
 */
export class TransactionMonitorService {
  private pool: Pool;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private intervalMs: number;

  constructor(pool: Pool, intervalMs: number = 30000) {
    this.pool = pool;
    this.intervalMs = intervalMs;
  }

  /**
   * Start monitoring pending transactions
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Transaction monitor already running');
      return;
    }

    console.log('🔍 Starting transaction monitor...');
    
    this.intervalId = setInterval(async () => {
      // Check if already processing to prevent race conditions
      if (this.isProcessing) {
        console.log('⏳ Previous check still processing, skipping...');
        return;
      }

      this.isProcessing = true;
      try {
        await this.checkPendingTransactions();
      } catch (error) {
        console.error('Error checking pending transactions:', error);
      } finally {
        this.isProcessing = false;
      }
    }, this.intervalMs);

    console.log(`✅ Transaction monitor started (interval: ${this.intervalMs}ms)`);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isProcessing = false;
      console.log('⏹️  Transaction monitor stopped');
    }
  }

  /**
   * Check and update pending transactions
   */
  private async checkPendingTransactions(): Promise<void> {
    try {
      // Query pending transactions
      const result = await this.pool.query(`
        SELECT * FROM transactions 
        WHERE status = 'pending' 
        AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC
      `);

      const pendingTransactions = result.rows;
      
      if (pendingTransactions.length === 0) {
        return;
      }

      console.log(`📋 Found ${pendingTransactions.length} pending transactions to check`);

      for (const tx of pendingTransactions) {
        await this.updateTransactionStatus(tx);
      }
    } catch (error) {
      console.error('Error in checkPendingTransactions:', error);
      throw error;
    }
  }

  /**
   * Update status of a specific transaction
   */
  private async updateTransactionStatus(tx: any): Promise<void> {
    try {
      // Transaction verification logic would go here
      // For now, this is a placeholder
      console.log(`Checking transaction ${tx.id}...`);
      
      // Update transaction status based on blockchain confirmation
      // This would integrate with TonBlockchainService or other blockchain services
    } catch (error) {
      console.error(`Error updating transaction ${tx.id}:`, error);
    }
  }

  /**
   * Get monitoring status
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get processing status
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export default TransactionMonitorService;
