import { Database } from '../db/connection';
import TonBlockchainService, { TransactionInfo } from './ton-blockchain.service';
import { WebhookService } from './webhook.service';

export interface DepositMonitorConfig {
  pollIntervalMs?: number;
  minConfirmations?: number;
}

interface ManualDepositRecord {
  id: string;
  user_id: string;
  payment_id?: string;
  conversion_id?: string;
  deposit_address: string;
  status: string;
  min_confirmations?: number;
  webhook_url?: string | null;
}

export class DepositMonitorService {
  private stopHandler?: () => void;
  private readonly pollIntervalMs: number;
  private readonly minConfirmations: number;

  constructor(
    private db: Database,
    private tonService: TonBlockchainService,
    private webhookService?: WebhookService,
    config: DepositMonitorConfig = {}
  ) {
    this.pollIntervalMs = config.pollIntervalMs ?? Number(process.env.DEPOSIT_POLL_INTERVAL_MS || 30000);
    this.minConfirmations = config.minConfirmations ?? Number(process.env.TON_MIN_CONFIRMATIONS || 1);
  }

  async start(): Promise<void> {
    await this.tonService.initializeWallet();
    this.stopHandler = await this.tonService.monitorDeposits(
      async (tx) => this.handleTransaction(tx),
      this.pollIntervalMs
    );
    console.log(`🛰️ Deposit monitor running (interval=${this.pollIntervalMs}ms, confirmations=${this.minConfirmations})`);
  }

  async stop(): Promise<void> {
    if (this.stopHandler) {
      this.stopHandler();
      this.stopHandler = undefined;
    }
  }

  private async handleTransaction(tx: TransactionInfo): Promise<void> {
    const deposit = await this.db.oneOrNone<ManualDepositRecord>(
      `SELECT md.*, u.webhook_url
       FROM manual_deposits md
       JOIN users u ON u.id = md.user_id
       WHERE md.deposit_address = $1
         AND md.status IN ('pending','awaiting_confirmation')
       ORDER BY md.created_at DESC
       LIMIT 1`,
      [tx.to]
    );

    if (!deposit) {
      return;
    }

    const confirmationsNeeded = deposit.min_confirmations || this.minConfirmations;

    await this.db.none(
      `UPDATE manual_deposits
         SET status = CASE WHEN status = 'pending' THEN 'awaiting_confirmation' ELSE status END,
             received_amount_ton = $1,
             tx_hash = $2,
             confirmations = $3,
             last_checked_at = NOW()
       WHERE id = $4`,
      [tx.amount, tx.hash, tx.confirmations, deposit.id]
    );

    if (tx.confirmations >= confirmationsNeeded) {
      await this.confirmDeposit(deposit, tx);
    }
  }

  private async confirmDeposit(deposit: ManualDepositRecord, tx: TransactionInfo): Promise<void> {
    await this.db.none(
      `UPDATE manual_deposits
         SET status = 'confirmed',
             confirmed_at = NOW(),
             confirmations = $1
       WHERE id = $2`,
      [tx.confirmations, deposit.id]
    );

    if (deposit.payment_id) {
      await this.db.none(
        `UPDATE payments
            SET status = 'converting',
                confirmed_at = NOW(),
                updated_at = NOW()
          WHERE id = $1
            AND status IN ('received','pending')`,
        [deposit.payment_id]
      );
    }

    let conversionId = deposit.conversion_id;
    if (!conversionId && deposit.payment_id) {
      const conversion = await this.db.oneOrNone<{ id: string }>(
        `SELECT id FROM conversions WHERE $1 = ANY(payment_ids) ORDER BY created_at DESC LIMIT 1`,
        [deposit.payment_id]
      );
      conversionId = conversion?.id;
      if (conversionId) {
        await this.db.none(
          `UPDATE manual_deposits
              SET conversion_id = $1
            WHERE id = $2`,
          [conversionId, deposit.id]
        );
      }
    }

    if (conversionId) {
      await this.db.none(
        `UPDATE conversions
            SET status = CASE WHEN status IN ('pending','rate_locked','phase1_prepared') THEN 'phase2_committed' ELSE status END,
                ton_tx_hash = COALESCE(ton_tx_hash, $2),
                settlement_status = CASE WHEN settlement_status IS NULL OR settlement_status = 'pending' THEN 'ready' ELSE settlement_status END,
                updated_at = NOW()
          WHERE id = $1`,
        [conversionId, tx.hash]
      );
    }

    if (deposit.webhook_url) {
      await this.webhookService?.queueEvent(
        deposit.user_id,
        deposit.webhook_url,
        'deposit.confirmed',
        {
          depositId: deposit.id,
          paymentId: deposit.payment_id,
          conversionId,
          txHash: tx.hash,
          amountTon: tx.amount,
          confirmations: tx.confirmations,
        }
      );
    }

    console.log('✅ Manual deposit confirmed', {
      depositId: deposit.id,
      paymentId: deposit.payment_id,
      conversionId,
      txHash: tx.hash,
    });
  }
}

export default DepositMonitorService;
