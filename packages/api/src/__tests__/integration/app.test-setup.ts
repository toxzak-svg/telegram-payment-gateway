import express from 'express';
import bodyParser from 'body-parser';

const mockPayments: any[] = [];
const mockConversions: any[] = [];

jest.mock('@tg-payment/core', () => {
  const actual = jest.requireActual('@tg-payment/core');

  class MockPaymentModel {
    async create(data: any) {
      const record = {
        id: `mock-payment-${mockPayments.length + 1}`,
        userId: data.userId,
        telegramInvoiceId: data.telegramInvoiceId,
        starsAmount: data.starsAmount,
        status: data.status,
        telegramPaymentId: data.telegramPaymentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPayments.push(record);
      return record;
    }

    async findById(id: string) {
      return mockPayments.find(p => p.id === id) || null;
    }

    async listByUser(userId: string) {
      const payments = mockPayments.filter(p => p.userId === userId);
      return { payments, total: payments.length };
    }

    async getStatsByUser(userId: string) {
      const payments = mockPayments.filter(p => p.userId === userId);
      const totalStars = payments.reduce((sum, p) => sum + p.starsAmount, 0);
      const byStatus: Record<string, number> = {};
      payments.forEach(p => {
        byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      });
      return {
        totalPayments: payments.length,
        totalStars,
        byStatus,
      };
    }
  }

  class MockFeeService {
    async calculateFeesForPayment() {
      return { id: 'mock-fee' };
    }
  }

  class MockRateAggregatorService {
    async getAggregatedRate() {
      return {
        sourceCurrency: 'TON',
        targetCurrency: 'USD',
        averageRate: 2,
        bestRate: 2.1,
        rates: [
          { source: 'mockdex', value: 2.1, timestamp: Date.now() },
        ],
        timestamp: Date.now(),
      };
    }
  }

  class MockDirectConversionService {
    async getQuote(amount: number, sourceCurrency: string, targetCurrency: string) {
      return {
        amount,
        sourceCurrency,
        targetCurrency,
        rate: 2,
        tonAmount: amount / 100,
        expiresAt: Date.now() + 300_000,
      };
    }

    async lockRate(userId: string, amount: number, sourceCurrency: string, targetCurrency: string) {
      const conversion = {
        id: `mock-conversion-${mockConversions.length + 1}`,
        userId,
        amount,
        sourceCurrency,
        targetCurrency,
        status: 'rate_locked',
        createdAt: new Date(),
      };
      mockConversions.push(conversion);
      return conversion;
    }

    async getConversionById(id: string) {
      return mockConversions.find(c => c.id === id) || null;
    }

    async getUserConversions(userId: string) {
      return mockConversions.filter(c => c.userId === userId);
    }
  }

  return {
    ...actual,
    getDatabase: jest.fn(() => ({})),
    PaymentModel: jest.fn(() => new MockPaymentModel()),
    FeeService: jest.fn(() => new MockFeeService()),
    RateAggregatorService: jest.fn(() => new MockRateAggregatorService()),
    DirectConversionService: jest.fn(() => new MockDirectConversionService()),
  };
});

import routes from '../../routes/v1.routes';

export function buildTestApp() {
  mockPayments.length = 0;
  mockConversions.length = 0;
  const app = express();
  app.use(bodyParser.json());
  app.use('/api/v1', routes);
  return app;
}
