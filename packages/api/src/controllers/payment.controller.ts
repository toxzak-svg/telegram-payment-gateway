import { Request, Response, NextFunction } from 'express';
import { PaymentModel, FeeService, PaymentStatus, getDatabase } from '@tg-payment/core';
import type { Database } from '@tg-payment/core';
import { TelegramService } from '@tg-payment/core';
import { validate as validateUuid, v5 as uuidv5 } from 'uuid';

const USER_ID_NAMESPACE = '3b9d87a2-54d7-4878-9d87-351edcb2564b';

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

      const normalizedUserId = PaymentController.normalizeUserId(userId);

      const db = getDatabase();
      await PaymentController.ensureUserExists(db, normalizedUserId);
      const paymentModel = new PaymentModel(db);
      const telegramService = new TelegramService(process.env.TELEGRAM_BOT_TOKEN!, {
        paymentModel,
        resolveUserId: () => normalizedUserId,
        allowedCurrencies: ['XTR'],
        minStarsAmount: parseInt(process.env.MIN_CONVERSION_STARS || '100', 10),
      });

      console.log('📥 Webhook received:', {
        userId: normalizedUserId,
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
          const feeService = new FeeService(db);
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

      const normalizedUserId = PaymentController.normalizeUserId(userId);

      const db = getDatabase();
      await PaymentController.ensureUserExists(db, normalizedUserId);
      const paymentModel = new PaymentModel(db);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const status = req.query.status as PaymentStatus | undefined;

      const { payments, total } = await paymentModel.listByUser(normalizedUserId, {
        limit,
        offset,
        status
      });

      res.status(200).json({
        success: true,
        data: payments.map(p => ({
          id: p.id,
          starsAmount: p.starsAmount,
          status: p.status,
          telegramPaymentId: p.telegramPaymentId,
          createdAt: p.createdAt
        })),
        meta: {
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

      const normalizedUserId = PaymentController.normalizeUserId(userId);

      const db = getDatabase();
      await PaymentController.ensureUserExists(db, normalizedUserId);
      const paymentModel = new PaymentModel(db);
      const stats = await paymentModel.getStatsByUser(normalizedUserId);

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

  private static normalizeUserId(userId: string): string {
    if (validateUuid(userId)) {
      return userId;
    }

    const derivedId = uuidv5(userId, USER_ID_NAMESPACE);
    console.warn(`⚠️ Normalized non-UUID user id "${userId}" to deterministic uuid ${derivedId}`);
    return derivedId;
  }

  private static async ensureUserExists(db: Database, userId: string): Promise<void> {
    const suffix = userId.replace(/-/g, '').slice(0, 16) || userId;
    const apiKey = `pk_${suffix}`;
    const apiSecret = `sk_${suffix}`;

    await db.none(
      `INSERT INTO users (id, api_key, api_secret, app_name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        userId,
        apiKey,
        apiSecret,
        `Auto App ${suffix}`,
        'Auto-provisioned via webhook'
      ]
    );
  }
}

export default PaymentController;
