import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { TelegramService, ValidationError } from '@tg-payment/core';
import { PaymentRepository } from '../models/payment.repository';
import { logger } from '../utils/logger';

// Initialize services (in production, use dependency injection)
const paymentRepo = new PaymentRepository();
const telegramService = new TelegramService(process.env.TELEGRAM_WEBHOOK_SECRET || '');

export class PaymentController {
  /**
   * POST /api/v1/payments/webhook
   * Receive Telegram payment webhook
   */
  static async handleWebhook(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      const { successful_payment, pre_checkout_query, from } = req.body;

      if (successful_payment) {
        // Process successful payment
        const payment = telegramService.processSuccessfulPayment(
          successful_payment,
          from.id,
          from.username
        );

        // Store in repository
        const storedPayment = await paymentRepo.create({
          ...payment,
          userId: req.apiKey || 'unknown', // In production, map API key to user ID
        });

        logger.info('Payment received', {
          requestId,
          paymentId: storedPayment.id,
          stars: storedPayment.starsAmount,
        });

        return res.status(200).json({
          success: true,
          data: {
            paymentId: storedPayment.id,
            starsAmount: storedPayment.starsAmount,
          },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      if (pre_checkout_query) {
        // Validate pre-checkout
        const isValid = telegramService.verifyPreCheckoutQuery(pre_checkout_query.invoice_payload);

        if (!isValid) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_CHECKOUT', message: 'Pre-checkout validation failed' },
            requestId,
            timestamp: new Date().toISOString(),
          });
        }

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Invalid webhook payload' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Payment webhook error', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({
        success: false,
        error: { code: 'WEBHOOK_ERROR', message: 'Failed to process webhook' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/v1/payments/:id
   * Get payment details
   */
  static async getPayment(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_ID', message: 'Payment ID required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const payment = await paymentRepo.findById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Payment ${id} not found` },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        data: payment,
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get payment error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to retrieve payment' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/v1/payments
   * List payments for current user
   */
  static async listPayments(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      const userId = req.apiKey || 'unknown';
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const payments = await paymentRepo.findByUserId(userId, limit, offset);
      const stats = await paymentRepo.getStats(userId);

      return res.status(200).json({
        success: true,
        data: {
          payments,
          pagination: { limit, offset, total: stats.totalPayments },
          stats,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('List payments error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to list payments' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
