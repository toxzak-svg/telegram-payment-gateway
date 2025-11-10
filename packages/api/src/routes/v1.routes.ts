import { Router } from 'express';
import { paymentRouter } from '../controllers/payment.controller';
import { conversionRouter } from '../controllers/conversion.controller';
import { healthRouter } from '../controllers/health.controller';

const router = Router();

// Mount routes
router.use('/payments', paymentRouter);
router.use('/conversions', conversionRouter);
router.use('/health', healthRouter);

export default router;
