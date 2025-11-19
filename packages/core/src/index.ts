/**
 * @tg-payment/core
 * Core business logic for Telegram Payment Gateway
 * 
 * VERSION: 2.0.0 - Direct TON Integration (No Fragment API)
 * Updated: November 14, 2025
 */

// ============================================
// SERVICES (Updated - No Fragment)
// ============================================
export { TelegramService } from './services/Telegram.service';
export { DirectConversionService } from './services/direct-conversion.service';
export { TonPaymentService } from './services/ton-payment.service';
export { TonBlockchainService } from './services/ton-blockchain.service';
export { DexAggregatorService } from './services/dex-aggregator.service';
export { P2PLiquidityService } from './services/p2p-liquidity.service';
export { FeeService } from './services/fee.service';
export { FeeCollectionService } from './services/fee-collection.service';
export { RateAggregatorService } from './services/rate.aggregator';
export { PaymentService } from './services/payment.service';
export { WebhookService } from './services/webhook.service';
export { ReconciliationService } from './services/reconciliation.service';
export { WithdrawalService } from './services/withdrawal.service';
export { StarsP2PService } from './services/stars-p2p.service';
export { StarsOrderModel } from './models/stars-order.model';

// ============================================
// MODELS
// ============================================
export {
  PaymentModel,
  Payment,
  PaymentStatus
} from './models/payment.model';

export {
  ConversionModel,
  Conversion as ConversionRecord,
  ConversionStatus,
  Currency,
  ConversionFees
} from './models/conversion.model';

export {
  SettlementModel,
  Settlement,
  SettlementStatus,
  FiatCurrency,
  SettlementRecipient
} from './models/settlement.model';

// ============================================
// UTILITIES
// ============================================
export {
  RateLock,
  RateLockManager,
  rateLockManager
} from './utils/rate-locking';

export {
  ConversionState,
  StateTransition,
  ConversionStateMachine
} from './utils/state-machine';

export {
  ErrorCode,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  ConversionError,
  ErrorHandler
} from './utils/error-handler';

// ============================================
// DATABASE
// ============================================
export {
  Database,
  initDatabase,
  getDatabase,
  getPool,
  closeDatabase
} from './db/connection';

// ============================================
// CONFIGURATION
// ============================================
export { config } from './config/index';

// ============================================
// SERVER
// ============================================
export { ServerBase } from './server';

// ============================================
// VERSION INFO
// ============================================
export const VERSION = '2.0.0';
export const API_VERSION = 'v1';
export const INTEGRATION_METHOD = 'DIRECT_TON'; // No Fragment

console.log('✅ @tg-payment/core v2.0.0 initialized');
console.log('🔗 Integration: Direct TON Blockchain (No Fragment API)');
console.log('📦 Features: No KYC | No Holding Period | Instant Withdrawals');
