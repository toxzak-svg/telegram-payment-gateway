import { Router } from 'express';
import PaymentController from '../controllers/payment.controller';
import * as conversionController from '../controllers/conversion.controller';
import UserController from '../controllers/user.controller';
import AdminController from '../controllers/admin.controller';
import FeeCollectionController from '../controllers/fee-collection.controller';
import { authenticate } from '../middleware/auth.middleware';
import P2POrdersController from '../controllers/p2p-orders.controller';
import webhookRoutes from './webhooks.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook routes
router.use('/webhooks', webhookRoutes);

// Payment routes
router.post('/payments/webhook', PaymentController.handleTelegramWebhook);
router.get('/payments/:id', authenticate, PaymentController.getPayment);
router.get('/payments', authenticate, PaymentController.listPayments);
router.get('/payments/stats', authenticate, PaymentController.getPaymentStats);

// Conversion routes
router.get('/conversions/rate', conversionController.getRate);
router.post('/conversions', authenticate, conversionController.createConversion);
router.get('/conversions/:id', authenticate, conversionController.getConversion);
router.get('/conversions', authenticate, conversionController.getConversionHistory);

// P2P Order routes (Limit Orders)
router.post('/p2p/orders', authenticate, P2POrdersController.createOrder);
router.get('/p2p/orders', authenticate, P2POrdersController.listOpenOrders);
router.get('/p2p/orders/:id', authenticate, P2POrdersController.getOrder);
router.delete('/p2p/orders/:id', authenticate, P2POrdersController.cancelOrder);

// User routes
router.post('/users/register', UserController.register);
router.get('/users/me', authenticate, UserController.getMe);
router.post('/users/api-keys/regenerate', authenticate, UserController.regenerateApiKey);
router.get('/users/stats', authenticate, UserController.getStats);

// Admin routes
router.get('/admin/stats', authenticate, AdminController.getStats);
router.get('/admin/users', authenticate, AdminController.getUsers);
router.get('/admin/revenue', authenticate, AdminController.getRevenue);
router.get('/admin/revenue/summary', authenticate, AdminController.getRevenueSummary);
router.get('/admin/transactions/summary', authenticate, AdminController.getTransactionSummary);
router.get('/admin/config', authenticate, AdminController.getConfig);
router.put('/admin/config', authenticate, AdminController.updateConfig);

// Fee collection routes
router.get('/fees/stats', authenticate, FeeCollectionController.getFeeStats);
router.get('/fees/history', authenticate, FeeCollectionController.getFeeHistory);
router.post('/fees/collect', authenticate, FeeCollectionController.collectFees);
router.get('/fees/uncollected', authenticate, FeeCollectionController.getUncollected);
router.post('/fees/collections/:id/complete', authenticate, FeeCollectionController.markCompleted);
router.get('/fees/collections', authenticate, FeeCollectionController.getHistory);

// Temporary: Simple health check only
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy' });
});

// User routes (commented while we build controller methods)
// router.get('/users/me', authenticate, userController.getCurrentUser);
// router.get('/users/me/balance', authenticate, userController.getBalance);
// router.get('/users/me/transactions', authenticate, userController.getTransactions);

// Admin routes (basic health check only for now)
// router.get('/admin/stats', authenticate, requireAdmin, adminController.getStats);
// router.get('/admin/users', authenticate, requireAdmin, adminController.getUsers);
// router.get('/admin/users/:id', authenticate, requireAdmin, adminController.getUser);
// router.put('/admin/users/:id', authenticate, requireAdmin, adminController.updateUser);
// router.get('/admin/payments', authenticate, requireAdmin, adminController.getPayments);
// router.get('/admin/conversions', authenticate, requireAdmin, adminController.getConversions);

// Fee collection routes
// router.get('/fees/stats', authenticate, requireAdmin, feeCollectionController.getFeeStats);
// router.get('/fees/history', authenticate, requireAdmin, feeCollectionController.getFeeHistory);
// router.post('/fees/collect', authenticate, requireAdmin, feeCollectionController.collectFees);

export default router;
