import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';

const router = Router();

// Webhook endpoint for Telegram payments
router.post('/webhook', PaymentController.handleTelegramWebhook);

// Get payment statistics
router.get('/stats', PaymentController.getPaymentStats);

// List payments
router.get('/', PaymentController.listPayments);

// Get specific payment
router.get('/:id', PaymentController.getPayment);

export default router;
