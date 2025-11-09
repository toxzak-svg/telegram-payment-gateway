import { Router } from 'express';
import { paymentLimiter } from '../middleware/ratelimit.middleware';
import { PaymentController } from '../controllers/payment.controller';
import { ConversionController } from '../controllers/conversion.controller';
import { HealthController } from '../controllers/health.controller';
import { UserController } from '../controllers/user.controller';

const router = Router();

router.get('/health', HealthController.health);
router.get('/rates', HealthController.getRates);

router.get('/users/me', UserController.getMe);
router.post('/users/api-keys/regenerate', UserController.regenerateApiKey);
router.get('/users/stats', UserController.getStats);

router.post('/payments/webhook', paymentLimiter, PaymentController.handleWebhook);
router.get('/payments/:id', PaymentController.getPayment);
router.get('/payments', PaymentController.listPayments);

router.post('/conversions/estimate', ConversionController.estimateConversion);
router.post('/conversions/create', paymentLimiter, ConversionController.createConversion);
router.get('/conversions/:id/status', ConversionController.getConversionStatus);

export default router;
