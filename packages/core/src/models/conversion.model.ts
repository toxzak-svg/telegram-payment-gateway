import { Database } from '../db/connection';

export interface Conversion {
  id: string;
  paymentId?: string;
  paymentIds?: string[];
  sourceCurrency: Currency;
  targetCurrency: Currency;
  sourceAmount: number;
  targetAmount?: number;
  exchangeRate?: number;
  rateLockedUntil?: number;
  dexPoolId?: string;
  dexProvider?: string;
  dexTxHash?: string;
  tonTxHash?: string;
  status: ConversionStatus;
  fees?: ConversionFees;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export enum Currency {
  STARS = 'STARS',
  TON = 'TON',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

export enum ConversionStatus {
  PENDING = 'pending',
  RATE_LOCKED = 'rate_locked',
  PHASE1_PREPARED = 'phase1_prepared',
  PHASE2_COMMITTED = 'phase2_committed',
  PHASE3_CONFIRMED = 'phase3_confirmed',
  IN_PROGRESS = 'in_progress',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ConversionFees {
  telegram?: number;
  dex?: number;
  ton?: number;
  exchange?: number;
  total: number;
}

export class ConversionModel {
  constructor(private db: Database) {}

  /**
   * Create a new conversion
   */
  async create(data: {
    paymentIds: string[];
    sourceCurrency?: Currency;
    targetCurrency: Currency;
    sourceAmount?: number;
    status?: ConversionStatus;
  }): Promise<Conversion> {
    const result = await this.db.one(
      `INSERT INTO conversions (
        id, payment_ids, source_currency, target_currency, 
        source_amount, status, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
      ) RETURNING *`,
      [
        data.paymentIds,
        data.sourceCurrency || Currency.STARS,
        data.targetCurrency,
        data.sourceAmount || 0,
        data.status || ConversionStatus.PENDING
      ]
    );

    return this.mapToConversion(result);
  }

  /**
   * Find conversion by ID
   */
  async findById(id: string): Promise<Conversion | null> {
    try {
      const result = await this.db.one(
        'SELECT * FROM conversions WHERE id = $1',
        [id]
      );
      return this.mapToConversion(result);
    } catch (error) {
      return null;
    }
  }

  /**
   * Update conversion
   */
  async update(
    id: string,
    updates: {
      status?: ConversionStatus;
      exchangeRate?: number;
      rateLockedUntil?: number;
      dexPoolId?: string;
      dexProvider?: string;
      dexTxHash?: string;
      tonTxHash?: string;
      targetAmount?: number;
      sourceAmount?: number;
      fees?: ConversionFees;
      errorMessage?: string;
      completedAt?: Date;
    }
  ): Promise<Conversion> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(`${dbKey} = $${paramIndex}`);
        
        if (key === 'fees') {
          values.push(JSON.stringify(value));
        } else if (key === 'completedAt') {
          values.push(value);
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      return this.findById(id) as Promise<Conversion>;
    }

    const result = await this.db.one(
      `UPDATE conversions 
       SET ${fields.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      [...values, id]
    );

    return this.mapToConversion(result);
  }

  /**
   * List conversions for a user
   */
  async listByUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: ConversionStatus;
    } = {}
  ): Promise<{ conversions: Conversion[]; total: number }> {
    const { limit = 20, offset = 0, status } = options;

    // Join with payments to get user_id
    let whereClause = 'WHERE p.user_id = $1';
    const params: any[] = [userId];

    if (status) {
      whereClause += ' AND c.status = $2';
      params.push(status);
    }

    const [results, countResult] = await Promise.all([
      this.db.any(
        `SELECT DISTINCT c.* FROM conversions c
         JOIN payments p ON p.id = ANY(c.payment_ids)
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      this.db.one(
        `SELECT COUNT(DISTINCT c.id) as count FROM conversions c
         JOIN payments p ON p.id = ANY(c.payment_ids)
         ${whereClause}`,
        params
      )
    ]);

    return {
      conversions: results.map(r => this.mapToConversion(r)),
      total: parseInt(countResult.count)
    };
  }

  /**
   * Get conversion statistics
   */
  async getStats(userId?: string): Promise<{
    totalConversions: number;
    totalSourceAmount: number;
    totalTargetAmount: number;
    byStatus: Record<ConversionStatus, number>;
  }> {
    const whereClause = userId 
      ? 'WHERE p.user_id = $1' 
      : '';
    const params = userId ? [userId] : [];

    const [countResult, sumResults, statusResults] = await Promise.all([
      this.db.one(
        `SELECT COUNT(DISTINCT c.id) as count FROM conversions c
         ${userId ? 'JOIN payments p ON p.id = ANY(c.payment_ids)' : ''}
         ${whereClause}`,
        params
      ),
      this.db.one(
        `SELECT 
           COALESCE(SUM(c.source_amount), 0) as source_total,
           COALESCE(SUM(c.target_amount), 0) as target_total
         FROM conversions c
         ${userId ? 'JOIN payments p ON p.id = ANY(c.payment_ids)' : ''}
         ${whereClause}`,
        params
      ),
      this.db.any(
        `SELECT c.status, COUNT(*) as count FROM conversions c
         ${userId ? 'JOIN payments p ON p.id = ANY(c.payment_ids)' : ''}
         ${whereClause}
         GROUP BY c.status`,
        params
      )
    ]);

    const byStatus: Record<string, number> = {};
    statusResults.forEach(r => {
      byStatus[r.status] = parseInt(r.count);
    });

    return {
      totalConversions: parseInt(countResult.count),
      totalSourceAmount: parseFloat(sumResults.source_total),
      totalTargetAmount: parseFloat(sumResults.target_total),
      byStatus: byStatus as Record<ConversionStatus, number>
    };
  }

  /**
   * Map database row to Conversion object
   */
  private mapToConversion(row: any): Conversion {
    return {
      id: row.id,
      paymentId: row.payment_id,
      paymentIds: row.payment_ids,
      sourceCurrency: row.source_currency as Currency,
      targetCurrency: row.target_currency as Currency,
      sourceAmount: parseFloat(row.source_amount),
      targetAmount: row.target_amount ? parseFloat(row.target_amount) : undefined,
      exchangeRate: row.exchange_rate ? parseFloat(row.exchange_rate) : undefined,
      rateLockedUntil: row.rate_locked_until ? parseInt(row.rate_locked_until) : undefined,
      dexPoolId: row.dex_pool_id,
      dexProvider: row.dex_provider,
      dexTxHash: row.dex_tx_hash,
      tonTxHash: row.ton_tx_hash,
      status: row.status as ConversionStatus,
      fees: typeof row.fees === 'string' ? JSON.parse(row.fees) : row.fees,
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    };
  }
}
