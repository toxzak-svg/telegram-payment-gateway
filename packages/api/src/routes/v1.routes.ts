import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';
import ConversionController from '../controllers/conversion.controller';
import { UserController } from '../controllers/user.controller';
import AdminController from '../controllers/admin.controller';
import FeeCollectionController from '../controllers/fee-collection.controller';
import authenticateApiKey, { optionalAuth } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/ratelimit.middleware';

const router = Router();

// Create rate limit instances ONCE at module load
const strictLimit = createRateLimiter({ windowMs: 60000, maxRequests: 10 });
const standardLimit = createRateLimiter({ windowMs: 60000, maxRequests: 60 });
const relaxedLimit = createRateLimiter({ windowMs: 60000, maxRequests: 100 });

// User endpoints
router.post('/users/register', strictLimit, UserController.register);
router.get('/users/me', authenticateApiKey, standardLimit, UserController.getMe);
router.post('/users/api-keys/regenerate', authenticateApiKey, strictLimit, UserController.regenerateApiKey);
router.get('/users/stats', authenticateApiKey, standardLimit, UserController.getStats);

// Payment endpoints
router.post('/payments/webhook', relaxedLimit, PaymentController.handleTelegramWebhook);
router.get('/payments/stats', authenticateApiKey, standardLimit, PaymentController.getPaymentStats);
router.get('/payments/:id', authenticateApiKey, standardLimit, PaymentController.getPayment);
router.get('/payments', authenticateApiKey, standardLimit, PaymentController.listPayments);

// Conversion endpoints
router.post('/conversions/estimate', authenticateApiKey, standardLimit, ConversionController.estimateConversion);
router.post('/conversions/create', authenticateApiKey, strictLimit, ConversionController.createConversion);
router.post('/conversions/lock-rate', authenticateApiKey, strictLimit, ConversionController.lockRate);
router.get('/conversions/:id/status', authenticateApiKey, standardLimit, ConversionController.getStatus);
router.get('/conversions', authenticateApiKey, standardLimit, ConversionController.listConversions);

// Fee Collection endpoints (NEW!)
router.get('/fees/uncollected', authenticateApiKey, standardLimit, FeeCollectionController.getUncollected);
router.post('/fees/collect', authenticateApiKey, strictLimit, FeeCollectionController.requestCollection);
router.get('/fees/collections', authenticateApiKey, standardLimit, FeeCollectionController.getHistory);
router.post('/fees/collections/:id/complete', authenticateApiKey, strictLimit, FeeCollectionController.markCompleted);

// Admin endpoints
router.get('/admin/revenue', standardLimit, AdminController.getRevenue);
router.get('/admin/revenue/summary', standardLimit, AdminController.getRevenueSummary);
router.get('/admin/config', standardLimit, AdminController.getConfig);
router.put('/admin/config', strictLimit, AdminController.updateConfig);

export default router;
