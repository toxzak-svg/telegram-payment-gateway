import { IDatabase } from 'pg-promise';
import TonBlockchainService from './ton-blockchain.service';

export class TransactionMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isProcessing = false;

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

    this.intervalId = setInterval(async () => {
      if (this.isProcessing) {
        console.log('⏭️ Skipping check - previous check still processing');
        return;
      }
      
      this.isProcessing = true;
      try {
        await this.checkPendingTransactions();
      } finally {
        this.isProcessing = false;
      }
    }, intervalMs);
  }

  async stop() {
    this.isRunning = false;
    this.isProcessing = false;
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
}

export default TransactionMonitorService;
