import { Database } from '../db/connection';
import { SettlementModel, SettlementStatus, FiatCurrency } from '../models/settlement.model';
import { WebhookService } from './webhook.service';

export interface SettlementServiceConfig {
  batchSize?: number;
  processingIntervalMs?: number;
  tonUsdRate?: number;
}

interface ConversionRecord {
  id: string;
  user_id: string;
  target_amount: number;
  target_currency: string;
  payment_ids: string[] | null;
  settlement_id?: string | null;
  webhook_url?: string | null;
}

interface PendingSettlementRow {
  settlement_id: string;
  user_id: string;
  conversion_id: string;
  fiat_amount: number | string;
  payment_ids: string[] | null;
  webhook_url?: string | null;
}

export class SettlementService {
  private readonly settlementModel: SettlementModel;
  private readonly batchSize: number;
  private readonly tonUsdRate: number;
  private readonly processingIntervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private db: Database,
    private webhookService?: WebhookService,
    config: SettlementServiceConfig = {}
  ) {
    this.settlementModel = new SettlementModel(db);
    this.batchSize = config.batchSize ?? Number(process.env.SETTLEMENT_BATCH_SIZE || 25);
    this.processingIntervalMs = config.processingIntervalMs ?? Number(process.env.SETTLEMENT_INTERVAL_MS || 60000);
    this.tonUsdRate = config.tonUsdRate ?? Number(process.env.SETTLEMENT_TON_USD_RATE || 5.5);
  }

  async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    await this.processCycle();
    this.timer = setInterval(() => {
      this.processCycle().catch((err) => console.error('Settlement cycle failed:', err));
    }, this.processingIntervalMs);

    console.log(`🏦 Settlement processor running (interval=${this.processingIntervalMs}ms, batch=${this.batchSize})`);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async processCycle(): Promise<void> {
    await this.prepareReadySettlements();
    await this.completePendingSettlements();
  }

  private async prepareReadySettlements(): Promise<void> {
    const conversions = await this.db.any<ConversionRecord>(
      `SELECT c.id, c.user_id, c.target_amount, c.target_currency, c.payment_ids, c.settlement_id, u.webhook_url
         FROM conversions c
         JOIN users u ON u.id = c.user_id
        WHERE c.status = 'completed'
          AND (c.settlement_status IS NULL OR c.settlement_status IN ('pending','ready'))
        ORDER BY c.completed_at NULLS LAST
        LIMIT $1`,
      [this.batchSize]
    );

    for (const conversion of conversions) {
      const fiatAmount = this.calculateFiatAmount(conversion.target_amount, conversion.target_currency);
      let settlementId = conversion.settlement_id;

      if (!settlementId) {
        const settlement = await this.settlementModel.create({
          userId: conversion.user_id,
          conversionId: conversion.id,
          fiatAmount,
          fiatCurrency: FiatCurrency.USD,
          exchangePlatform: 'p2p-liquidity',
          status: SettlementStatus.PENDING
        });
        settlementId = settlement.id;
      }

      await this.db.none(
        `UPDATE conversions
            SET settlement_status = 'processing',
                settlement_id = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [conversion.id, settlementId]
      );
    }
  }

  private async completePendingSettlements(): Promise<void> {
    const settlements = await this.db.any<PendingSettlementRow>(
      `SELECT s.id as settlement_id, s.user_id, s.conversion_id, s.fiat_amount, c.payment_ids, u.webhook_url
         FROM settlements s
         JOIN conversions c ON c.id = s.conversion_id
         JOIN users u ON u.id = s.user_id
        WHERE s.status IN ('pending','processing')
        ORDER BY s.created_at ASC
        LIMIT $1`,
      [this.batchSize]
    );

    for (const settlement of settlements) {
      const paymentIds = Array.isArray(settlement.payment_ids)
        ? settlement.payment_ids
        : [];
      const webhookUrl = settlement.webhook_url || undefined;
      const fiatAmount = typeof settlement.fiat_amount === 'number'
        ? settlement.fiat_amount
        : parseFloat(settlement.fiat_amount as unknown as string);

      await this.db.none(
        `UPDATE settlements
            SET status = 'completed',
                completed_at = NOW(),
                transaction_id = $2
          WHERE id = $1`,
        [settlement.settlement_id, this.generateSettlementTx(settlement.settlement_id)]
      );

      await this.db.none(
        `UPDATE conversions
            SET settlement_status = 'settled',
                updated_at = NOW()
          WHERE id = $1`,
        [settlement.conversion_id]
      );

      if (paymentIds.length > 0) {
        await this.db.none(
          `UPDATE payments
              SET status = 'settled',
                  updated_at = NOW()
            WHERE id = ANY($1::uuid[])`,
          [paymentIds]
        );
      }

      if (webhookUrl) {
        await this.webhookService?.queueEvent(
          settlement.user_id,
          webhookUrl,
          'settlement.completed',
          {
            settlementId: settlement.settlement_id,
            conversionId: settlement.conversion_id,
            fiatAmount,
            currency: 'USD'
          }
        );
      }

      console.log('✅ Settlement completed', {
        settlementId: settlement.settlement_id,
        conversionId: settlement.conversion_id,
      });
    }
  }

  private calculateFiatAmount(targetAmount: number, targetCurrency: string): number {
    if (targetCurrency === 'TON' || targetCurrency === 'USDT') {
      return parseFloat((targetAmount * this.tonUsdRate).toFixed(2));
    }
    return parseFloat(targetAmount.toFixed(2));
  }

  private generateSettlementTx(id: string): string {
    return `AUTO-SETTLED-${id}-${Date.now()}`;
  }
}

export default SettlementService;
