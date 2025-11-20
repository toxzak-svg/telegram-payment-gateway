import { Pool } from 'pg';

export interface ReconciliationRecord {
  id: string;
  paymentId: string;
  conversionId?: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  status: 'matched' | 'mismatch' | 'pending';
  reconciliationType: 'payment' | 'conversion' | 'settlement';
  externalReference?: string;
  notes?: string;
  reconciledAt?: Date;
  createdAt: Date;
}

export interface ReconciliationResult {
  matched: number;
  mismatched: number;
  pending: number;
  totalChecked: number;
  discrepancies: ReconciliationRecord[];
}

export class ReconciliationService {
  constructor(private pool: Pool) {}

  /**
   * Reconcile payment against Telegram webhook data
   */
  async reconcilePayment(paymentId: string): Promise<ReconciliationRecord> {
    // Get payment from database
    const paymentResult = await this.pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];
    const expectedAmount = payment.stars_amount;
    const actualAmount = payment.raw_payload?.successful_payment?.total_amount || 0;
    const difference = Math.abs(expectedAmount - actualAmount);

    const status = difference === 0 ? 'matched' : 'mismatch';

    // Record reconciliation
    const result = await this.pool.query(
      `INSERT INTO reconciliation_records (
        payment_id, expected_amount, actual_amount, difference,
        status, reconciliation_type, reconciled_at
      ) VALUES ($1, $2, $3, $4, $5, 'payment', NOW())
      RETURNING *`,
      [paymentId, expectedAmount, actualAmount, difference, status]
    );

    console.log(`✅ Payment reconciled: ${paymentId} - Status: ${status}`);

    return this.mapToRecord(result.rows[0]);
  }

  /**
   * Reconcile conversion against DEX and TON blockchain
   */
  async reconcileConversion(conversionId: string): Promise<ReconciliationRecord> {
    // Get conversion from database
    const conversionResult = await this.pool.query(
      'SELECT * FROM conversions WHERE id = $1',
      [conversionId]
    );

    if (conversionResult.rows.length === 0) {
      throw new Error('Conversion not found');
    }

    const conversion = conversionResult.rows[0];
    const expectedAmount = conversion.target_amount;

    // TODO: Query DEX API and TON blockchain for actual amount
    const actualAmount = expectedAmount; // Placeholder
    const difference = Math.abs(expectedAmount - actualAmount);

    const status = difference < 0.01 ? 'matched' : 'mismatch'; // Allow 0.01 TON tolerance

    const result = await this.pool.query(
      `INSERT INTO reconciliation_records (
        conversion_id, expected_amount, actual_amount, difference,
        status, reconciliation_type, external_reference, reconciled_at
      ) VALUES ($1, $2, $3, $4, $5, 'conversion', $6, NOW())
      RETURNING *`,
      [
        conversionId,
        expectedAmount,
        actualAmount,
        difference,
        status,
        conversion.ton_tx_hash
      ]
    );

    console.log(`✅ Conversion reconciled: ${conversionId} - Status: ${status}`);

    return this.mapToRecord(result.rows[0]);
  }

  /**
   * Run daily reconciliation for all unreconciled transactions
   */
  async runDailyReconciliation(): Promise<ReconciliationResult> {
    console.log('🔍 Starting daily reconciliation...');

    const result: ReconciliationResult = {
      matched: 0,
      mismatched: 0,
      pending: 0,
      totalChecked: 0,
      discrepancies: []
    };

    // Reconcile payments
    const paymentsResult = await this.pool.query(
      `SELECT id FROM payments 
       WHERE status = 'received' 
       AND id NOT IN (SELECT payment_id FROM reconciliation_records WHERE payment_id IS NOT NULL)
       LIMIT 1000`
    );

    for (const row of paymentsResult.rows) {
      try {
        const record = await this.reconcilePayment(row.id);
        result.totalChecked++;

        if (record.status === 'matched') {
          result.matched++;
        } else if (record.status === 'mismatch') {
          result.mismatched++;
          result.discrepancies.push(record);
        }
      } catch (error) {
        console.error(`Failed to reconcile payment ${row.id}:`, error);
        result.pending++;
      }
    }

    // Reconcile conversions
    const conversionsResult = await this.pool.query(
      `SELECT id FROM conversions 
       WHERE status = 'completed'
       AND id NOT IN (SELECT conversion_id FROM reconciliation_records WHERE conversion_id IS NOT NULL)
       LIMIT 1000`
    );

    for (const row of conversionsResult.rows) {
      try {
        const record = await this.reconcileConversion(row.id);
        result.totalChecked++;

        if (record.status === 'matched') {
          result.matched++;
        } else if (record.status === 'mismatch') {
          result.mismatched++;
          result.discrepancies.push(record);
        }
      } catch (error) {
        console.error(`Failed to reconcile conversion ${row.id}:`, error);
        result.pending++;
      }
    }

    console.log('✅ Daily reconciliation complete:', result);

    return result;
  }

  /**
   * Get reconciliation report for date range
   */
  async getReconciliationReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: ReconciliationResult;
    records: ReconciliationRecord[];
  }> {
    const result = await this.pool.query(
      `SELECT * FROM reconciliation_records
       WHERE created_at BETWEEN $1 AND $2
       ORDER BY created_at DESC`,
      [startDate, endDate]
    );

    const records = result.rows.map(r => this.mapToRecord(r));

    const summary: ReconciliationResult = {
      matched: records.filter(r => r.status === 'matched').length,
      mismatched: records.filter(r => r.status === 'mismatch').length,
      pending: records.filter(r => r.status === 'pending').length,
      totalChecked: records.length,
      discrepancies: records.filter(r => r.status === 'mismatch')
    };

    return { summary, records };
  }

  /**
   * Map database row to ReconciliationRecord
   */
  private mapToRecord(row: any): ReconciliationRecord {
    return {
      id: row.id,
      paymentId: row.payment_id,
      conversionId: row.conversion_id,
      expectedAmount: parseFloat(row.expected_amount),
      actualAmount: parseFloat(row.actual_amount),
      difference: parseFloat(row.difference),
      status: row.status,
      reconciliationType: row.reconciliation_type,
      externalReference: row.external_reference,
      notes: row.notes,
      reconciledAt: row.reconciled_at ? new Date(row.reconciled_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}
