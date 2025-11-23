import { apiClient } from './client';
import {
  Payment,
  Conversion,
  User,
  DashboardStats,
  P2POrder,
  DexQuote,
  LiquiditySource,
  WebhookEvent,
  RevenueSummaryEntry,
  TransactionSummaryEntry,
  ApiResponse,
} from '../types';

export const paymentService = {
  async getPayments(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<ApiResponse<Payment[]>> {
    const { data } = await apiClient.get<ApiResponse<Payment[]>>('/payments', {
      params,
    });
    return data as any;
  },

  async getPayment(id: string): Promise<Payment> {
    const { data } = await apiClient.get<ApiResponse<Payment>>(
      `/payments/${id}`
    );
    return data.data;
  },
};

export const conversionService = {
  async getConversions(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Conversion[]> {
    const { data } = await apiClient.get<ApiResponse<Conversion[]>>(
      '/conversions',
      { params }
    );
    return (data as any).data;
  },

  async getConversion(id: string): Promise<Conversion> {
    const { data } = await apiClient.get<ApiResponse<Conversion>>(
      `/conversions/${id}`
    );
    return data.data;
  },

  async createConversion(params: {
    sourceAmount: number;
    sourceCurrency: string;
    targetCurrency: string;
  }): Promise<Conversion> {
    const { data } = await apiClient.post<ApiResponse<Conversion>>(
      '/conversions',
      params
    );
    return data.data;
  },
};

export const userService = {
  async getProfile(): Promise<User> {
    const { data } = await apiClient.get<{ success: boolean; user: User }>('/users/me');
    return data.user;
  },

  async updateWebhookUrl(webhookUrl: string): Promise<User> {
    const { data } = await apiClient.patch<ApiResponse<User>>(
      '/user/webhook',
      { webhookUrl }
    );
    return data.data;
  },

  async regenerateApiKey(): Promise<{ apiKey: string }> {
    const { data } = await apiClient.post<ApiResponse<{ apiKey: string }>>(
      '/user/regenerate-key'
    );
    return data.data;
  },

  async testWebhook(): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post('/user/test-webhook');
    return data.data;
  },
};

export const statsService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await apiClient.get<{ success: boolean; stats: DashboardStats }>(
      '/admin/stats'
    );

    return data.stats;
  },

  async getRevenueSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<RevenueSummaryEntry[]> {
    const { data } = await apiClient.get<{
      success: boolean;
      summary: RevenueSummaryEntry[];
    }>('/admin/revenue/summary', { params });

    return data.summary;
  },

  async getTransactionSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<TransactionSummaryEntry[]> {
    const { data } = await apiClient.get<{
      success: boolean;
      summary: TransactionSummaryEntry[];
    }>('/admin/transactions/summary', { params });

    return data.summary;
  },
};

export const p2pService = {
  async getOrders(params?: {
    type?: 'buy' | 'sell';
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<P2POrder[]>> {
    const { data } = await apiClient.get<ApiResponse<P2POrder[]>>(
      '/p2p/orders',
      { params }
    );
    return data as any;
  },

  async createOrder(order: {
    type: 'buy' | 'sell';
    starsAmount: number;
    rate: string;
  }): Promise<P2POrder> {
    const { data } = await apiClient.post<ApiResponse<P2POrder>>(
      '/p2p/orders',
      order
    );
    return data.data;
  },

  async cancelOrder(orderId: string): Promise<void> {
    await apiClient.delete(`/p2p/orders/${orderId}`);
  },
};

export const dexService = {
  async getQuote(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<DexQuote> {
    const { data } = await apiClient.get<ApiResponse<DexQuote>>('/dex/quote', {
      params: { fromCurrency, toCurrency, amount },
    });
    return data.data;
  },

  async getLiquidity(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<{ sources: LiquiditySource[] }> {
    const { data } = await apiClient.get<
      ApiResponse<{ sources: LiquiditySource[] }>
    >('/dex/liquidity', {
      params: { fromCurrency, toCurrency, amount },
    });
    return data.data;
  },

  async getBestRoute(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<{
    sources: LiquiditySource[];
    totalRate: number;
    totalFee: number;
    estimatedTime: number;
  }> {
    const { data } = await apiClient.get('/dex/best-route', {
      params: { fromCurrency, toCurrency, amount },
    });
    return data.data;
  },
};

export const webhookService = {
  async getWebhookEvents(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<ApiResponse<WebhookEvent[]>> {
    const { data} = await apiClient.get<ApiResponse<WebhookEvent[]>>(
      '/webhooks/events',
      { params }
    );
    return data.data;
  },
};
