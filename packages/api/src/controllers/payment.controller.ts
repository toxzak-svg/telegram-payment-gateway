import { Request, Response, NextFunction } from 'express';
import { PaymentModel, FeeService, PaymentStatus } from '@tg-payment/core';
import { getDatabase } from '@tg-payment/core';
import { TelegramService } from '@tg-payment/core';

export class PaymentController {
  /**
   * Handle Telegram payment webhook
   * POST /api/v1/payments/webhook
   */
  static async handleTelegramWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const payload = req.body;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'X-User-Id header is required'
          }
        });
        return;
      }

      const db = getDatabase();
      const paymentModel = new PaymentModel(db);
      const telegramService = new TelegramService(process.env.TELEGRAM_BOT_TOKEN!, {
        paymentModel,
        resolveUserId: () => userId,
        allowedCurrencies: ['XTR'],
        minStarsAmount: parseInt(process.env.MIN_CONVERSION_STARS || '100', 10),
      });

      console.log('📥 Webhook received:', {
        userId,
        hasPayment: !!payload.message?.successful_payment,
      });

      // Process successful payment
      if (payload.message?.successful_payment) {
        const payment = await telegramService.processSuccessfulPayment(payload);

        console.log('✅ Payment created:', payment.id);

        // Wait a tiny bit to ensure DB transaction is committed
        await new Promise(resolve => setTimeout(resolve, 10));

        // 💰 CALCULATE AND CREATE PLATFORM FEES
        try {
          const feeService = new FeeService(db as any);
          await feeService.calculateFeesForPayment(payment.id);
          console.log('💰 Platform fee created for payment:', payment.id);
        } catch (feeError: any) {
          console.error('⚠️ Fee calculation error:', feeError.message);
        }

        res.status(200).json({
          success: true,
          payment: {
            id: payment.id,
            starsAmount: payment.starsAmount,
            status: payment.status,
            createdAt: payment.createdAt
          },
          message: 'Payment processed successfully',
        });
        return;
      }

      // Process pre-checkout query
      if (payload.pre_checkout_query) {
        res.status(200).json({
          success: true,
          verified: true,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Webhook acknowledged',
      });
    } catch (error: any) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'WEBHOOK_ERROR',
          message: error.message
        }
      });
    }
  }

  /**
   * Get payment by ID
   * GET /api/v1/payments/:id
   */
  static async getPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const db = getDatabase();
      const paymentModel = new PaymentModel(db);
      const payment = await paymentModel.findById(id);

      if (!payment) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Payment not found' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          userId: payment.userId,
          starsAmount: payment.starsAmount,
          status: payment.status,
          telegramPaymentId: payment.telegramPaymentId,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List payments for authenticated user
   * GET /api/v1/payments
   */
  static async listPayments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'X-User-Id header is required' }
        });
        return;
      }

      const db = getDatabase();
      const paymentModel = new PaymentModel(db);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const status = req.query.status as PaymentStatus | undefined;

      const { payments, total } = await paymentModel.listByUser(userId, {
        limit,
        offset,
        status
      });

      res.status(200).json({
        success: true,
        payments: payments.map(p => ({
          id: p.id,
          starsAmount: p.starsAmount,
          status: p.status,
          telegramPaymentId: p.telegramPaymentId,
          createdAt: p.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment statistics
   * GET /api/v1/payments/stats
   */
  static async getPaymentStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_USER_ID', message: 'X-User-Id header is required' }
        });
        return;
      }

      const db = getDatabase();
      const paymentModel = new PaymentModel(db);
      const stats = await paymentModel.getStatsByUser(userId);

      res.status(200).json({
        success: true,
        stats: {
          totalPayments: stats.totalPayments,
          totalStars: stats.totalStars,
          byStatus: stats.byStatus
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default PaymentController;
