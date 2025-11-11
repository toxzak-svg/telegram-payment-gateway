import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';
import ConversionController from '../controllers/conversion.controller';
import { UserController } from '../controllers/user.controller';
import { authenticateApiKey, optionalAuth } from '../middleware/auth.middleware';
import rateLimit from '../middleware/rateLimit.middleware';

const router = Router();

// Rate limit configurations
const strictLimit = rateLimit({ windowMs: 60000, maxRequests: 10 }); // 10 req/min
const standardLimit = rateLimit({ windowMs: 60000, maxRequests: 60 }); // 60 req/min
const relaxedLimit = rateLimit({ windowMs: 60000, maxRequests: 100 }); // 100 req/min

// User endpoints (public registration, protected profile)
router.post('/users/register', strictLimit, UserController.register);
router.get('/users/me', authenticateApiKey, standardLimit, UserController.getMe);
router.post('/users/api-keys/regenerate', authenticateApiKey, strictLimit, UserController.regenerateApiKey);
router.get('/users/stats', authenticateApiKey, standardLimit, UserController.getStats);

// Payment endpoints (webhook is public with different auth, others protected)
router.post('/payments/webhook', relaxedLimit, PaymentController.handleTelegramWebhook);
router.get('/payments/stats', authenticateApiKey, standardLimit, PaymentController.getPaymentStats);
router.get('/payments/:id', authenticateApiKey, standardLimit, PaymentController.getPayment);
router.get('/payments', authenticateApiKey, standardLimit, PaymentController.listPayments);

// Conversion endpoints (all protected)
router.post('/conversions/estimate', authenticateApiKey, standardLimit, ConversionController.estimateConversion);
router.post('/conversions/create', authenticateApiKey, strictLimit, ConversionController.createConversion);
router.post('/conversions/lock-rate', authenticateApiKey, strictLimit, ConversionController.lockRate);
router.get('/conversions/:id/status', authenticateApiKey, standardLimit, ConversionController.getStatus);
router.get('/conversions', authenticateApiKey, standardLimit, ConversionController.listConversions);

export default router;
