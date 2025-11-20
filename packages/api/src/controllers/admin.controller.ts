import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDatabase, FeeService, AdminAnalyticsService } from '@tg-payment/core';

export class AdminController {
  private static getServices() {
    const db = getDatabase();
    const feeService = new FeeService(db as any);
    const analyticsService = new AdminAnalyticsService(db as any);
    return { db, feeService, analyticsService };
  }

  /**
   * GET /api/v1/admin/stats
   */
  static async getStats(req: Request, res: Response) {
    const requestId = uuid();
    try {
      const { analyticsService } = AdminController.getServices();
      const stats = await analyticsService.getDashboardStats();

      return res.status(200).json({
        success: true,
        stats,
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'STATS_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/users
   */
  static async getUsers(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        users: [],
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'USERS_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/users/:id
   */
  static async getUser(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        user: {},
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'USER_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * PUT /api/v1/admin/users/:id
   */
  static async updateUser(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        message: 'User updated',
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/payments
   */
  static async getPayments(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        payments: [],
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'PAYMENTS_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/conversions
   */
  static async getConversions(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        conversions: [],
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'CONVERSIONS_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/revenue
   */
  static async getRevenue(req: Request, res: Response) {
    const requestId = uuid();

    try {
      const { feeService } = AdminController.getServices();
      const revenue = await feeService.getTotalRevenue();

      return res.status(200).json({
        success: true,
        revenue,
        requestId,
      });
    } catch (error: any) {
      console.error('❌ Get revenue error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'REVENUE_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/revenue/summary
   */
  static async getRevenueSummary(req: Request, res: Response) {
    const requestId = uuid();

    try {
      const { analyticsService } = AdminController.getServices();
      const { startDate, endDate } = req.query;

      const start = startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const end = endDate
        ? new Date(endDate as string)
        : new Date();

      const summary = await analyticsService.getRevenueSummary(start, end);

      return res.status(200).json({
        success: true,
        summary,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        requestId,
      });
    } catch (error: any) {
      console.error('❌ Get revenue summary error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'SUMMARY_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/transactions/summary
   */
  static async getTransactionSummary(req: Request, res: Response) {
    const requestId = uuid();

    try {
      const { analyticsService } = AdminController.getServices();
      const { startDate, endDate } = req.query;

      const start = startDate
        ? new Date(startDate as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const end = endDate
        ? new Date(endDate as string)
        : new Date();

      const summary = await analyticsService.getTransactionSummary(start, end);

      return res.status(200).json({
        success: true,
        summary,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        requestId,
      });
    } catch (error: any) {
      console.error('❌ Get transaction summary error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'TRANSACTION_SUMMARY_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/admin/config
   */
  static async getConfig(req: Request, res: Response) {
    const requestId = uuid();

    try {
      const { feeService } = AdminController.getServices();
      const config = await feeService.getConfig();

      return res.status(200).json({
        success: true,
        config: {
          platformFeePercentage: `${(config.platformFeePercentage * 100).toFixed(2)}%`,
          dexFeePercentage: `${(config.dexFeePercentage * 100).toFixed(2)}%`,
          dexSlippageTolerance: `${(config.dexSlippageTolerance * 100).toFixed(2)}%`,
          preferredDexProvider: config.preferredDexProvider,
          networkFeePercentage: `${(config.networkFeePercentage * 100).toFixed(2)}%`,
          platformTonWallet: config.platformTonWallet,
          minConversionAmount: config.minConversionAmount,
        },
        requestId,
      });
    } catch (error: any) {
      console.error('❌ Get config error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * PUT /api/v1/admin/config
   */
  static async updateConfig(req: Request, res: Response) {
    const requestId = uuid();

    try {
      const { db } = AdminController.getServices();
      const {
        platformFeePercentage,
        dexFeePercentage,
        dexSlippageTolerance,
        preferredDexProvider,
        networkFeePercentage,
        platformTonWallet,
        minConversionAmount,
      } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (platformFeePercentage !== undefined) {
        updates.push(`platform_fee_percentage = $${paramIndex++}`);
        values.push(parseFloat(platformFeePercentage) / 100);
      }

      if (dexFeePercentage !== undefined) {
        updates.push(`dex_fee_percentage = $${paramIndex++}`);
        values.push(parseFloat(dexFeePercentage) / 100);
      }

      if (dexSlippageTolerance !== undefined) {
        updates.push(`dex_slippage_tolerance = $${paramIndex++}`);
        values.push(parseFloat(dexSlippageTolerance) / 100);
      }

      if (preferredDexProvider) {
        updates.push(`preferred_dex_provider = $${paramIndex++}`);
        values.push(preferredDexProvider);
      }

      if (networkFeePercentage !== undefined) {
        updates.push(`network_fee_percentage = $${paramIndex++}`);
        values.push(parseFloat(networkFeePercentage) / 100);
      }

      if (platformTonWallet) {
        updates.push(`platform_ton_wallet = $${paramIndex++}`);
        values.push(platformTonWallet);
      }

      if (minConversionAmount !== undefined) {
        updates.push(`min_conversion_amount = $${paramIndex++}`);
        values.push(parseInt(minConversionAmount));
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_UPDATES', message: 'No configuration updates provided' },
          requestId,
        });
      }

      updates.push(`updated_at = NOW()`);

      await db.query(
        `UPDATE platform_config SET ${updates.join(', ')} WHERE is_active = true`,
        values
      );

      console.log('✅ Platform config updated:', req.body);

      return res.status(200).json({
        success: true,
        message: 'Configuration updated successfully',
        requestId,
      });
    } catch (error: any) {
      console.error('❌ Update config error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ERROR', message: error.message },
        requestId,
      });
    }
  }
}

export default AdminController;
