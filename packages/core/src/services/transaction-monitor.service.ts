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
