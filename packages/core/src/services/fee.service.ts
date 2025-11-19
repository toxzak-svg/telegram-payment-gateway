import { Database } from '../db/connection';

import { Pool } from 'pg';

export interface PlatformConfig {
  platformFeePercentage: number;
  dexFeePercentage: number;
  dexSlippageTolerance: number;
  preferredDexProvider: 'dedust' | 'stonfi' | 'auto';
  networkFeePercentage: number;
  platformTonWallet: string;
  minConversionAmount: number;
}

export interface FeeBreakdown {
  platform: number;
  dex: number;
  network: number;
  total: number;
  platformPercentage: number;
}

export interface PlatformFee {
  id: string;
  payment_id: string;
  user_id: string;
  fee_percentage: number;
  fee_amount_stars: number;
  fee_amount_ton: number;
  status: string;
  created_at: Date;
}

export class FeeService {
  private pool: Pool;
  private config: PlatformConfig | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get platform configuration (cached)
   */
  async getConfig(): Promise<PlatformConfig> {
    if (this.config) {
      return this.config;
    }

    const result = await this.pool.query(
      `SELECT
        platform_fee_percentage,
        dex_fee_percentage,
        dex_slippage_tolerance,
        preferred_dex_provider,
        network_fee_percentage,
        platform_ton_wallet,
        min_conversion_amount
      FROM platform_config
      WHERE is_active = true
      LIMIT 1`
    );

    if (result.rows.length === 0) {
      throw new Error('Platform configuration not found');
    }

    const row = result.rows[0];
    this.config = {
      platformFeePercentage: parseFloat(row.platform_fee_percentage),
      dexFeePercentage: parseFloat(row.dex_fee_percentage),
      dexSlippageTolerance: parseFloat(row.dex_slippage_tolerance ?? 0),
      preferredDexProvider: (row.preferred_dex_provider || 'dedust') as
        | 'dedust'
        | 'stonfi'
        | 'auto',
      networkFeePercentage: parseFloat(row.network_fee_percentage),
      platformTonWallet: row.platform_ton_wallet,
      minConversionAmount: row.min_conversion_amount,
    };

    return this.config;
  }

  /**
   * Calculate fees for a given amount
   */
  async calculateFeeBreakdown(sourceAmount: number): Promise<FeeBreakdown> {
    const config = await this.getConfig();

    const platformFee = sourceAmount * config.platformFeePercentage;
    const dexFee = sourceAmount * config.dexFeePercentage;
    const networkFee = sourceAmount * config.networkFeePercentage;

    return {
      platform: platformFee,
      dex: dexFee,
      network: networkFee,
      total: platformFee + dexFee + networkFee,
      platformPercentage: config.platformFeePercentage * 100,
    };
  }

  /**
   * Calculate and record fees for a payment
   * Works with payment UUIDs
   */
  async calculateFeesForPayment(paymentId: string): Promise<PlatformFee> {
    // Get payment details
    const paymentResult = await this.pool.query(
      `SELECT id, user_id, stars_amount FROM payments WHERE id = $1`,
      [paymentId]
    );

    if (!paymentResult.rows || paymentResult.rows.length === 0) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const payment = paymentResult.rows[0];

    if (!payment.stars_amount) {
      throw new Error(`Payment ${paymentId} has no stars_amount`);
    }

    const config = await this.getConfig();

    // Calculate fee amounts
    const feeAmountStars = payment.stars_amount * config.platformFeePercentage;
    const feeAmountTon = 0; // Will be calculated during conversion
    const feeAmountUsd = 0; // Will be calculated during conversion

    // Record the fee - ✅ FIXED: Added array brackets
    const result = await this.pool.query(
      `INSERT INTO platform_fees (
        payment_id,
        user_id,
        fee_percentage,
        fee_amount_stars,
        fee_amount_ton,
        fee_amount_usd,
        status,
        fee_type
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'platform')
      RETURNING *`,
      [
        paymentId,
        payment.user_id,
        config.platformFeePercentage,
        feeAmountStars,
        feeAmountTon,
        feeAmountUsd,
      ]
    );

    console.log('💰 Platform fee recorded:', {
      paymentId,
      feeStars: feeAmountStars,
      feePercentage: config.platformFeePercentage,
    });

    return result.rows[0];
  }

  /**
   * Record platform fee for a conversion
   */
  async recordFee(
    conversionId: string,
    userId: string,
    feeAmountStars: number,
    feeAmountTon: number,
    exchangeRate: number
  ): Promise<PlatformFee> {
    const config = await this.getConfig();
    const feeAmountUsd = feeAmountTon * exchangeRate;

    // ✅ FIXED: Added array brackets
    const result = await this.pool.query(
      `INSERT INTO platform_fees (
        conversion_id,
        user_id,
        fee_percentage,
        fee_amount_stars,
        fee_amount_ton,
        fee_amount_usd,
        status,
        fee_type
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'platform')
      RETURNING *`,
      [
        conversionId,
        userId,
        config.platformFeePercentage,
        feeAmountStars,
        feeAmountTon,
        feeAmountUsd,
      ]
    );

    console.log('💰 Platform fee recorded:', {
      conversionId,
      feeStars: feeAmountStars,
      feeTon: feeAmountTon,
      feeUsd: feeAmountUsd,
    });

    return result.rows[0];
  }

  /**
   * Get total fees collected
   */
  async getTotalRevenue(): Promise<{
    totalFeesStars: number;
    totalFeesTon: number;
    totalFeesUsd: number;
    collectedTon: number;
    pendingTon: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        SUM(fee_amount_stars) as total_fees_stars,
        SUM(fee_amount_ton) as total_fees_ton,
        SUM(fee_amount_usd) as total_fees_usd,
        SUM(CASE WHEN status = 'collected' THEN fee_amount_ton ELSE 0 END) as collected_ton,
        SUM(CASE WHEN status = 'pending' THEN fee_amount_ton ELSE 0 END) as pending_ton
      FROM platform_fees
    `);

    const row = result.rows[0];
    return {
      totalFeesStars: parseFloat(row.total_fees_stars || 0),
      totalFeesTon: parseFloat(row.total_fees_ton || 0),
      totalFeesUsd: parseFloat(row.total_fees_usd || 0),
      collectedTon: parseFloat(row.collected_ton || 0),
      pendingTon: parseFloat(row.pending_ton || 0),
    };
  }

  /**
   * Get revenue summary by date range
   */
  async getRevenueSummary(
    startDate: Date,
    endDate: Date
  ): Promise<Array<any>> {
    const result = await this.pool.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as total_fees,
        SUM(fee_amount_stars) as total_stars_fees,
        SUM(fee_amount_ton) as total_ton_fees
      FROM platform_fees
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [startDate, endDate]
    );

    return result.rows.map((row: any) => ({
      date: row.date,
      totalFees: parseInt(row.total_fees),
      totalStarsFees: parseFloat(row.total_stars_fees),
      totalTonFees: parseFloat(row.total_ton_fees),
    }));
  }

  /**
   * Mark fee as collected
   */
  async markFeeCollected(feeId: string, txHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE platform_fees
      SET status = 'collected',
          collection_tx_hash = $1,
          collected_at = NOW(),
          updated_at = NOW()
      WHERE id = $2`,
      [txHash, feeId]
    );

    console.log('✅ Fee marked as collected:', { feeId, txHash });
  }

  /**
   * Get platform TON wallet address
   */
  async getPlatformWallet(): Promise<string> {
    const config = await this.getConfig();
    return config.platformTonWallet;
  }
}

export default FeeService;
