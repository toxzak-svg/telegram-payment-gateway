import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../../core/src/services/payment.service';
import { pool } from '../db/connection';

const paymentService = new PaymentService(pool);

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

      console.log('📥 Webhook received:', {
        hasPayment: !!payload.message?.successful_payment,
        hasPreCheckout: !!payload.pre_checkout_query,
      });

      // Process successful payment
      if (payload.message?.successful_payment) {
        // In production, get userId from authenticated request
        // For now, use a test user ID
        const userId = req.headers['x-user-id'] as string || 'test-user-id';
        
        const payment = await paymentService.processSuccessfulPayment(
          userId,
          payload
        );

        res.status(200).json({
          success: true,
          paymentId: payment.id,
          starsAmount: payment.stars_amount,
          message: 'Payment processed successfully',
        });
        return;
      }

      // Process pre-checkout query
      if (payload.pre_checkout_query) {
        const userId = req.headers['x-user-id'] as string || 'test-user-id';
        const isValid = await paymentService.verifyPreCheckout(userId, payload);

        res.status(200).json({
          success: true,
          verified: isValid,
        });
        return;
      }

      // Unknown webhook type - acknowledge but don't process
      res.status(200).json({
        success: true,
        message: 'Webhook acknowledged',
      });
    } catch (error: any) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
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
      const payment = await paymentService.getPaymentById(id);

      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        payment,
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
      const userId = req.headers['x-user-id'] as string || 'test-user-id';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const payments = await paymentService.getUserPayments(userId, limit, offset);

      res.status(200).json({
        success: true,
        data: payments,
        pagination: {
          page,
          limit,
          total: payments.length,
        },
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
      const userId = req.headers['x-user-id'] as string || 'test-user-id';
      const stats = await paymentService.getUserStats(userId);

      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default PaymentController;
