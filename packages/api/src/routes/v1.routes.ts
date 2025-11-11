import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';
import ConversionController from '../controllers/conversion.controller';
import { UserController } from '../controllers/user.controller';

const router = Router();

// User endpoints (public - no auth required for registration)
router.post('/users/register', UserController.register);
router.get('/users/me', UserController.getMe);
router.post('/users/api-keys/regenerate', UserController.regenerateApiKey);
router.get('/users/stats', UserController.getStats);

// Payment endpoints
router.post('/payments/webhook', PaymentController.handleTelegramWebhook);
router.get('/payments/stats', PaymentController.getPaymentStats);
router.get('/payments/:id', PaymentController.getPayment);
router.get('/payments', PaymentController.listPayments);

// Conversion endpoints
router.post('/conversions/estimate', ConversionController.estimateConversion);
router.post('/conversions/create', ConversionController.createConversion);
router.post('/conversions/lock-rate', ConversionController.lockRate);
router.get('/conversions/:id/status', ConversionController.getStatus);
router.get('/conversions', ConversionController.listConversions);

// Add settlement endpoints as needed

export default router;
