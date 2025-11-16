import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDatabase, FeeCollectionService } from '@tg-payment/core';

export class FeeCollectionController {
  private static getServices() {
    const db = getDatabase();
    const feeCollectionService = new FeeCollectionService(db as any);
    return { db, feeCollectionService };
  }

  /**
   * GET /api/v1/fees/stats
   */
  static async getFeeStats(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        stats: { totalFees: 0, collectedFees: 0, pendingFees: 0 },
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
   * GET /api/v1/fees/history
   */
  static async getFeeHistory(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        history: [],
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'HISTORY_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * POST /api/v1/fees/collect
   */
  static async collectFees(req: Request, res: Response) {
    const requestId = uuid();
    try {
      return res.status(200).json({
        success: true,
        message: 'Fees collected',
        requestId,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'COLLECT_ERROR', message: error.message },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/fees/uncollected
   * Get total uncollected platform fees
   */
  static async getUncollected(req: Request, res: Response) {
    const requestId = uuid();

    try {
      const { feeCollectionService } = FeeCollectionController.getServices();
      const uncollected = await feeCollectionService.getUncollectedFees();

      return res.status(200).json({
        success: true,
        uncollected: {
          totalStars: uncollected.totalStars,
          totalTon: uncollected.totalTon,
          totalUsd: uncollected.totalUsd,
          feeCount: uncollected.feeCount
        },
        requestId
      });
    } catch (error: any) {
      console.error('❌ Get uncollected fees error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'UNCOLLECTED_ERROR', message: error.message },
        requestId
      });
    }
  }

  /**
   * POST /api/v1/fees/collect
   * Request fee collection/withdrawal
   */
  static async requestCollection(req: Request, res: Response) {
    const requestId = uuid();
    const userId = req.headers['x-user-id'] as string;

    try {
      const { feeCollectionService } = FeeCollectionController.getServices();
      const { targetAddress, feeIds } = req.body;

      if (!targetAddress) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_ADDRESS', message: 'Target TON address required' },
          requestId
        });
      }

      const collection = await feeCollectionService.createCollectionRequest(
        userId,
        { targetAddress, feeIds }
      );

      return res.status(201).json({
        success: true,
        collection: {
          id: collection.id,
          totalFeesTon: collection.totalFeesTon,
          totalFeesUsd: collection.totalFeesUsd,
          feesCollected: collection.feesCollected,
          status: collection.status,
          targetAddress,
          createdAt: collection.createdAt
        },
        message: 'Fee collection request created. Transfer will be processed shortly.',
        requestId
      });
    } catch (error: any) {
      console.error('❌ Request collection error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'COLLECTION_ERROR', message: error.message },
        requestId
      });
    }
  }

  /**
   * POST /api/v1/fees/collections/:id/complete
   * Mark collection as completed (internal use after TON transfer)
   */
  static async markCompleted(req: Request, res: Response) {
    const requestId = uuid();
    const { id } = req.params;
    const { txHash } = req.body;

    try {
      const { feeCollectionService } = FeeCollectionController.getServices();

      if (!txHash) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_TX_HASH', message: 'Transaction hash required' },
          requestId
        });
      }

      await feeCollectionService.markAsCollected(id, txHash);

      return res.status(200).json({
        success: true,
        message: 'Fee collection marked as completed',
        requestId
      });
    } catch (error: any) {
      console.error('❌ Mark completed error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'COMPLETE_ERROR', message: error.message },
        requestId
      });
    }
  }

  /**
   * GET /api/v1/fees/collections
   * Get collection history
   */
  static async getHistory(req: Request, res: Response) {
    const requestId = uuid();
    const userId = req.headers['x-user-id'] as string;

    try {
      const { feeCollectionService } = FeeCollectionController.getServices();
      const limit = parseInt(req.query.limit as string) || 20;

      const collections = await feeCollectionService.getCollectionHistory(userId, limit);

      return res.status(200).json({
        success: true,
        collections: collections.map(c => ({
          id: c.id,
          totalFeesTon: c.totalFeesTon,
          totalFeesUsd: c.totalFeesUsd,
          feesCollected: c.feesCollected,
          status: c.status,
          txHash: c.txHash,
          createdAt: c.createdAt
        })),
        requestId
      });
    } catch (error: any) {
      console.error('❌ Get history error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'HISTORY_ERROR', message: error.message },
        requestId
      });
    }
  }
}

export default FeeCollectionController;
