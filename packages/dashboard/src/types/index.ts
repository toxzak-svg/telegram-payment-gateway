export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'received' | 'converting' | 'settled' | 'failed';
  telegramUserId: string;
  telegramPaymentChargeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversion {
  id: string;
  paymentId: string;
  sourceAmount: number;
  sourceCurrency: string;
  targetAmount: number;
  targetCurrency: string;
  rate: number;
  status: 'pending' | 'rate_locked' | 'awaiting_ton' | 'ton_received' | 'converting_fiat' | 'completed' | 'failed';
  dexProvider?: 'dedust' | 'stonfi' | 'p2p';
  dexTxHash?: string;
  dexPoolId?: string;
  feeBreakdown?: {
    telegram: number;
    ton: number;
    dex: number;
    exchange: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  apiKey: string;
  webhookUrl?: string;
  platformFeePercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalRevenueTon: number;
  totalRevenueStars: number;
  totalTransactions: number;
  totalPayments: number;
  totalUsers: number;
  activeMerchants: number;
  successRate: number;
  revenueChange: number;
  transactionChange: number;
  activeMerchantsChange: number;
  successRateChange: number;
}

export interface RevenueSummaryEntry {
  date: string;
  tonAmount: number;
  starsAmount: number;
  total: number;
}

export interface TransactionSummaryEntry {
  date: string;
  total: number;
  completed: number;
}

export interface P2POrder {
  id: string;
  type: 'buy' | 'sell';
  userId: string;
  starsAmount: number;
  tonAmount: string;
  rate: string;
  status: 'open' | 'matched' | 'completed' | 'cancelled' | 'expired';
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DexQuote {
  provider: 'dedust' | 'stonfi';
  rate: number;
  liquidityUsd: number;
  priceImpact: number;
  estimatedGas: number;
}

export interface LiquiditySource {
  type: 'p2p' | 'dex';
  provider?: 'dedust' | 'stonfi';
  rate: number;
  liquidity: number;
  liquidityUsd?: number;
  fee: number;
  executionTime: number;
}

export interface WebhookEvent {
  id: string;
  event: string;
  url: string;
  status: 'pending' | 'delivered' | 'failed';
  statusCode?: number;
  attempts: number;
  payload: Record<string, unknown>;
  response?: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface ChartData {
  date: string;
  value: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}
