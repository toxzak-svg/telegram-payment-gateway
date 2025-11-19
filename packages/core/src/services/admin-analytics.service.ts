import { IDatabase } from 'pg-promise';

export interface DashboardStats {
  totalRevenueTon: number;
  totalRevenueStars: number;
  totalTransactions: number;
  totalPayments: number;
  totalUsers: number;
  activeMerchants: number;
  successRate: number;
  revenueChange: number;
  transactionChange: number;
  activeMerchantsChange: number;
  successRateChange: number;
}

export interface DailyMetric {
  date: string;
  total: number;
  completed?: number;
  tonAmount?: number;
  starsAmount?: number;
}

export class AdminAnalyticsService {
  constructor(private readonly db: IDatabase<any>) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const result = await this.db.one(`
      WITH fee_totals AS (
        SELECT
          COALESCE(SUM(fee_amount_ton), 0) AS total_fee_ton,
          COALESCE(SUM(fee_amount_stars), 0) AS total_fee_stars,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN fee_amount_ton END), 0) AS current_fee_ton,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days' THEN fee_amount_ton END), 0) AS previous_fee_ton
        FROM platform_fees
      ),
      conversion_stats AS (
        SELECT
          COUNT(*) AS total_conversions,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS current_conversions,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS previous_conversions,
          COUNT(*) FILTER (WHERE status = 'completed') AS total_success,
          COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '30 days') AS current_success,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS current_total,
          COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS previous_success,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS previous_total
        FROM conversions
      ),
      payment_stats AS (
        SELECT
          COUNT(*) AS total_payments,
          COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS current_active_merchants,
          COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS previous_active_merchants
        FROM payments
      ),
      user_stats AS (
        SELECT COUNT(*) AS total_users FROM users
      )
      SELECT
        fee_totals.total_fee_ton,
        fee_totals.total_fee_stars,
        fee_totals.current_fee_ton,
        fee_totals.previous_fee_ton,
        conversion_stats.total_conversions,
        conversion_stats.current_conversions,
        conversion_stats.previous_conversions,
        conversion_stats.current_success,
        conversion_stats.current_total,
        conversion_stats.previous_success,
        conversion_stats.previous_total,
        payment_stats.total_payments,
        payment_stats.current_active_merchants,
        payment_stats.previous_active_merchants,
        user_stats.total_users
      FROM fee_totals, conversion_stats, payment_stats, user_stats
    `);

    const totalRevenueTon = parseFloat(result.total_fee_ton) || 0;
    const totalRevenueStars = parseFloat(result.total_fee_stars) || 0;

    const currentFeeTon = parseFloat(result.current_fee_ton) || 0;
    const previousFeeTon = parseFloat(result.previous_fee_ton) || 0;

    const totalTransactions = parseInt(result.total_conversions, 10) || 0;
    const currentTransactions = parseInt(result.current_conversions, 10) || 0;
    const previousTransactions = parseInt(result.previous_conversions, 10) || 0;

    const totalPayments = parseInt(result.total_payments, 10) || 0;
    const currentActiveMerchants = parseInt(result.current_active_merchants, 10) || 0;
    const previousActiveMerchants = parseInt(result.previous_active_merchants, 10) || 0;
    const totalUsers = parseInt(result.total_users, 10) || 0;

    const currentSuccess = parseInt(result.current_success, 10) || 0;
    const currentTotal = parseInt(result.current_total, 10) || 0;
    const previousSuccess = parseInt(result.previous_success, 10) || 0;
    const previousTotal = parseInt(result.previous_total, 10) || 0;

    const successRate = currentTotal > 0 ? (currentSuccess / currentTotal) * 100 : 0;
    const previousSuccessRate = previousTotal > 0 ? (previousSuccess / previousTotal) * 100 : 0;

    return {
      totalRevenueTon,
      totalRevenueStars,
      totalTransactions,
      totalPayments,
      totalUsers,
      activeMerchants: currentActiveMerchants,
      successRate,
      revenueChange: this.calculateChange(currentFeeTon, previousFeeTon),
      transactionChange: this.calculateChange(currentTransactions, previousTransactions),
      activeMerchantsChange: this.calculateChange(currentActiveMerchants, previousActiveMerchants),
      successRateChange: successRate - previousSuccessRate,
    };
  }

  async getRevenueSummary(startDate: Date, endDate: Date): Promise<DailyMetric[]> {
    const rows = await this.db.manyOrNone(
      `SELECT
        DATE(created_at) AS date,
        COALESCE(SUM(fee_amount_ton), 0) AS total_ton,
        COALESCE(SUM(fee_amount_stars), 0) AS total_stars
      FROM platform_fees
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
      `,
      [startDate, endDate]
    );

    return rows.map((row) => ({
      date: row.date,
      tonAmount: parseFloat(row.total_ton) || 0,
      starsAmount: parseFloat(row.total_stars) || 0,
      total: parseFloat(row.total_ton) || 0,
    }));
  }

  async getTransactionSummary(startDate: Date, endDate: Date): Promise<DailyMetric[]> {
    const rows = await this.db.manyOrNone(
      `SELECT
        DATE(created_at) AS date,
        COUNT(*) AS total_conversions,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_conversions
      FROM conversions
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
      `,
      [startDate, endDate]
    );

    return rows.map((row) => ({
      date: row.date,
      total: parseInt(row.total_conversions, 10) || 0,
      completed: parseInt(row.completed_conversions, 10) || 0,
    }));
  }

  private calculateChange(current: number, previous: number): number {
    if (previous <= 0 && current <= 0) {
      return 0;
    }

    if (previous === 0) {
      return 100;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
  }
}
