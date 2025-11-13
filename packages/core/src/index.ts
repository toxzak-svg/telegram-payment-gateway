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
// SERVICES
// ============================================
export { TelegramService } from './services/telegram.service';
export { FragmentService } from './services/fragment.service';
export { FeeService } from './services/fee.service';
export { TonPaymentService } from './services/ton-payment.service';
export { ReconciliationService } from './services/reconciliation.service';
export { WebhookService } from './services/webhook.service';
export { FeeCollectionService } from './services/fee-collection.service';

// ============================================
// UTILS
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
  closeDatabase
} from './db/connection';
