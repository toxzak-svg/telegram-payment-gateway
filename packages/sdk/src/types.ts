// ==================== CONFIG ====================

export interface PaymentGatewayConfig {
  apiKey: string;
  apiSecret?: string;
  apiUrl?: string;
  timeout?: number;
}

// ==================== CURRENCIES ====================

export type Currency = 'STARS' | 'TON' | 'USD' | 'EUR' | 'GBP';

export type PaymentStatus = 
  | 'pending' 
  | 'received' 
  | 'converting' 
  | 'converted' 
  | 'settled' 
  | 'failed';

export type ConversionStatusType = 
  | 'pending' 
  | 'rate_locked' 
  | 'phase1_prepared' 
  | 'phase2_committed' 
  | 'phase3_confirmed'
  | 'in_progress' 
  | 'confirmed' 
  | 'completed' 
  | 'failed';

// ==================== CONVERSION ====================

export interface EstimationParams {
  starsAmount: number;
  targetCurrency: Currency;
  lockedRate?: boolean;
}

export interface EstimationResult {
  starsAmount: number;
  tonEquivalent?: number;
  estimatedFiat?: number;
  targetCurrency: Currency;
  exchangeRate: number;
  lockedUntil?: number;
  fees: {
    telegram?: number;
    dex?: number;
    ton?: number;
    exchange?: number;
    total: number;
  };
}

export interface RateLockParams {
  starsAmount: number;
  targetCurrency: Currency;
  durationSeconds?: number;
}

export interface RateLock {
  id: string;
  exchangeRate: number;
  lockedUntil: number;
  starsAmount: number;
  targetCurrency: Currency;
}

export interface ConversionParams {
  paymentIds: string[];
  targetCurrency: Currency;
  rateLockId?: string;
}

export interface Conversion {
  id: string;
  paymentIds: string[];
  sourceCurrency: Currency;
  targetCurrency: Currency;
  sourceAmount: number;
  targetAmount?: number;
  exchangeRate?: number;
  rateLockedUntil?: number;
  dexPoolId?: string;
  dexProvider?: string;
  dexTxHash?: string;
  tonTxHash?: string;
  status: ConversionStatusType;
  fees?: {
    telegram?: number;
    dex?: number;
    ton?: number;
    exchange?: number;
    total: number;
  };
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ConversionStatus {
  status: ConversionStatusType;
  conversion: Conversion;
  progress?: {
    phase: string;
    percentage: number;
    estimatedCompletion?: number;
  };
}

// ==================== PAYMENT ====================

export interface Payment {
  id: string;
  userId: string;
  telegramInvoiceId: string;
  starsAmount: number;
  status: PaymentStatus;
  telegramPaymentId: string;
  rawPayload?: any;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentStats {
  totalPayments: number;
  totalStars: number;
  byStatus: Record<PaymentStatus, number>;
}

// ==================== USER ====================

export interface UserProfile {
  id: string;
  appName: string;
  apiKey: string;
  webhookUrl?: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

// ==================== RATES ====================

export interface ExchangeRates {
  [key: string]: {
    [key: string]: number;
  };
}

// ==================== ERRORS ====================

export interface APIError {
  message: string;
  code: string;
  status: number;
  details?: any;
}
