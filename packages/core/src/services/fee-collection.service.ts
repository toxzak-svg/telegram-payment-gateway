import { IDatabase } from 'pg-promise';

export interface FeeCollectionRequest {
  targetAddress: string;
  feeIds?: string[];
}

export interface FeeCollectionResult {
  id: string;
  totalFeesStars: number;
  totalFeesTon: number;
  totalFeesUsd: number;
  feesCollected: number;
  status: string;
  txHash?: string;
  createdAt: Date;
}

export class FeeCollectionService {
  constructor(private db: IDatabase<any>) {}

  /**
   * Get total uncollected fees (pending)
   */
  async getUncollectedFees(): Promise<{
    totalStars: number;
    totalTon: number;
    totalUsd: number;
    feeCount: number;
  }> {
    const result = await this.db.one(
      `SELECT 
        COUNT(*) as fee_count,
        COALESCE(SUM(fee_amount_stars), 0) as total_stars,
        COALESCE(SUM(fee_amount_ton), 0) as total_ton,
        COALESCE(SUM(fee_amount_usd), 0) as total_usd
       FROM platform_fees 
       WHERE status = 'pending'`
    );

    return {
      feeCount: parseInt(result.fee_count),
      totalStars: parseFloat(result.total_stars),
      totalTon: parseFloat(result.total_ton),
      totalUsd: parseFloat(result.total_usd)
    };
  }

  /**
   * Create fee collection request
   */
  async createCollectionRequest(
    userId: string,
    request: FeeCollectionRequest
  ): Promise<FeeCollectionResult> {
    // Get pending fees
    let feeQuery = 'SELECT * FROM platform_fees WHERE status = \'pending\'';
    const params: any[] = [];

    if (request.feeIds && request.feeIds.length > 0) {
      feeQuery += ' AND id = ANY($1)';
      params.push(request.feeIds);
    }

    const fees = await this.db.manyOrNone(feeQuery, params);

    if (!fees || fees.length === 0) {
      throw new Error('No pending fees to collect');
    }

    // Calculate totals
    const totalStars = fees.reduce((sum, f) => sum + parseFloat(f.fee_amount_stars || 0), 0);
    const totalTon = fees.reduce((sum, f) => sum + parseFloat(f.fee_amount_ton || 0), 0);
    const totalUsd = fees.reduce((sum, f) => sum + parseFloat(f.fee_amount_usd || 0), 0);

    // Create collection record
    const result = await this.db.one(
      `INSERT INTO fee_collections (
        user_id, fee_ids, target_address, total_fees_stars, 
        total_fees_ton, total_fees_usd, fees_collected, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
      RETURNING *`,
      [
        userId,
        fees.map(f => f.id),
        request.targetAddress,
        totalStars,
        totalTon,
        totalUsd,
        fees.length
      ]
    );

    console.log(`📊 Fee collection request created: ${result.id}`);
    console.log(`💰 Total to collect: ${totalTon} TON (${totalUsd} USD)`);

    return {
      id: result.id,
      totalFeesStars: totalStars,
      totalFeesTon: totalTon,
      totalFeesUsd: totalUsd,
      feesCollected: fees.length,
      status: 'pending',
      createdAt: new Date(result.created_at)
    };
  }

  /**
   * Mark collection as completed (after TON transfer)
   */
  async markAsCollected(
    collectionId: string,
    txHash: string
  ): Promise<void> {
    // Update collection record
    await this.db.none(
      `UPDATE fee_collections 
       SET status = 'completed', tx_hash = $1, collected_at = NOW()
       WHERE id = $2`,
      [txHash, collectionId]
    );

    // Get fee IDs
    const collection = await this.db.one(
      'SELECT fee_ids FROM fee_collections WHERE id = $1',
      [collectionId]
    );

    const feeIds = collection.fee_ids;

    // Mark all fees as collected
    await this.db.none(
      `UPDATE platform_fees 
       SET status = 'collected', collection_tx_hash = $1, collected_at = NOW()
       WHERE id = ANY($2)`,
      [txHash, feeIds]
    );

    console.log(`✅ Fees collected successfully. TX: ${txHash}`);
  }

  /**
   * Get collection history
   */
  async getCollectionHistory(userId: string, limit: number = 20): Promise<FeeCollectionResult[]> {
    const result = await this.db.manyOrNone(
      `SELECT * FROM fee_collections 
       WHERE user_id = $1
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.map(row => ({
      id: row.id,
      totalFeesStars: parseFloat(row.total_fees_stars),
      totalFeesTon: parseFloat(row.total_fees_ton),
      totalFeesUsd: parseFloat(row.total_fees_usd),
      feesCollected: row.fees_collected,
      status: row.status,
      txHash: row.tx_hash,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Get collection by ID
   */
  async getCollectionById(collectionId: string): Promise<FeeCollectionResult | null> {
    const row = await this.db.oneOrNone(
      'SELECT * FROM fee_collections WHERE id = $1',
      [collectionId]
    );

    if (!row) return null;

    return {
      id: row.id,
      totalFeesStars: parseFloat(row.total_fees_stars),
      totalFeesTon: parseFloat(row.total_fees_ton),
      totalFeesUsd: parseFloat(row.total_fees_usd),
      feesCollected: row.fees_collected,
      status: row.status,
      txHash: row.tx_hash,
      createdAt: new Date(row.created_at)
    };
  }
}
