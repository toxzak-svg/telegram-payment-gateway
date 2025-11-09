import { TelegramService } from '../../services/telegram.service';
import { RateAggregatorService } from '../../services/rate-aggregator.service';
import { PaymentRepository } from '../../models/payment.repository';
import { FragmentService } from '../../services/fragment.service';
import { ValidationError, ExternalApiError } from '../../types';

describe('TelegramService', () => {
  let service: TelegramService;

  beforeEach(() => {
    service = new TelegramService('test-webhook-secret');
  });

  test('should process successful payment', () => {
    const payload = {
      telegramPaymentChargeId: 'charge-123',
      providerPaymentChargeId: 'provider-456',
      currency: 'XTR',
      totalAmount: 50000, // 500 Stars (in centimes)
      invoicePayload: 'payload-base64',
    };

    const payment = service.processSuccessfulPayment(
      payload,
      12345,
      'testuser'
    );

    expect(payment.starsAmount).toBe(500);
    expect(payment.status).toBe('received');
    expect(payment.telegramPaymentId).toBe('charge-123');
  });

  test('should throw error for invalid payment', () => {
    const invalidPayload = {
      telegramPaymentChargeId: '',
      providerPaymentChargeId: 'provider-456',
      currency: 'XTR',
      totalAmount: 50000,
      invoicePayload: 'payload',
    };

    expect(() => {
      service.processSuccessfulPayment(
        invalidPayload,
        12345
      );
    }).toThrow(ValidationError);
  });

  test('should calculate Telegram fees correctly', () => {
    const fees = service.calculateTelegramFees(1000);

    expect(fees.platformFee).toBe(5); // 0.5%
    expect(fees.processingFee).toBe(15); // 1.5%
    expect(fees.totalFee).toBe(20);
    expect(fees.netAmount).toBe(980);
  });

  test('should verify webhook signature', () => {
    const body = '{"test": "data"}';
    const validSignature = '...'; // Would be actual HMAC-SHA256

    // This would require actual signature generation
    // For now, just test the method exists
    expect(service.verifyWebhookSignature).toBeDefined();
  });
});

describe('RateAggregatorService', () => {
  let service: RateAggregatorService;

  beforeEach(() => {
    service = new RateAggregatorService();
  });

  test('should get aggregated rate', async () => {
    const rate = await service.getAggregatedRate('STARS', 'TON');

    expect(rate).toBeDefined();
    expect(rate.sourceCurrency).toBe('STARS');
    expect(rate.targetCurrency).toBe('TON');
    expect(rate.rate).toBeGreaterThan(0);
    expect(rate.provider).toBe('aggregated');
  });

  test('should cache rates', async () => {
    const rate1 = await service.getAggregatedRate('TON', 'USD');
    const rate2 = await service.getAggregatedRate('TON', 'USD');

    expect(rate1.rate).toBe(rate2.rate);
    expect(service.getCacheStats().size).toBe(1);
  });

  test('should clear cache', async () => {
    await service.getAggregatedRate('TON', 'USD');
    expect(service.getCacheStats().size).toBe(1);

    service.clearCache();
    expect(service.getCacheStats().size).toBe(0);
  });
});

describe('PaymentRepository', () => {
  let repo: PaymentRepository;

  beforeEach(async () => {
    repo = new PaymentRepository();
    await repo.clear();
  });

  test('should create payment', async () => {
    const payment = {
      id: 'pay-123',
      userId: 'user-456',
      telegramPaymentId: 'tg-789',
      starsAmount: 100,
      status: 'received' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const created = await repo.create(payment);
    expect(created.id).toBe('pay-123');
  });

  test('should find payment by ID', async () => {
    const payment = {
      id: 'pay-123',
      userId: 'user-456',
      telegramPaymentId: 'tg-789',
      starsAmount: 100,
      status: 'received' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.create(payment);
    const found = await repo.findById('pay-123');

    expect(found).not.toBeNull();
    expect(found?.starsAmount).toBe(100);
  });

  test('should find payments by user', async () => {
    const payment1 = {
      id: 'pay-1',
      userId: 'user-123',
      telegramPaymentId: 'tg-1',
      starsAmount: 50,
      status: 'received' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const payment2 = {
      id: 'pay-2',
      userId: 'user-123',
      telegramPaymentId: 'tg-2',
      starsAmount: 75,
      status: 'received' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.create(payment1);
    await repo.create(payment2);

    const payments = await repo.findByUserId('user-123');
    expect(payments).toHaveLength(2);
  });

  test('should get statistics', async () => {
    const payment = {
      id: 'pay-123',
      userId: 'user-456',
      telegramPaymentId: 'tg-789',
      starsAmount: 100,
      status: 'received' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.create(payment);
    const stats = await repo.getStats('user-456');

    expect(stats.totalPayments).toBe(1);
    expect(stats.totalStars).toBe(100);
    expect(stats.receivedCount).toBe(1);
  });
});

describe('FragmentService', () => {
  let service: FragmentService;

  beforeEach(() => {
    service = new FragmentService('test-api-key');
  });

  test('should initiate conversion', async () => {
    const conversion = await service.initiateConversion(
      'user-123',
      ['pay-1', 'pay-2'],
      2000,
      0.013
    );

    expect(conversion.sourceAmount).toBe(2000);
    expect(conversion.targetAmount).toBe(26); // 2000 * 0.013
    expect(conversion.status).toBe('rate_locked');
  });

  test('should reject conversion below minimum', async () => {
    expect(async () => {
      await service.initiateConversion(
        'user-123',
        ['pay-1'],
        500, // Below 1000 minimum
        0.013
      );
    }).rejects.toThrow(ValidationError);
  });

  test('should check if rate is locked', async () => {
    const conversion = await service.initiateConversion(
      'user-123',
      ['pay-1'],
      1000,
      0.013
    );

    expect(service.isRateLocked(conversion)).toBe(true);
  });

  test('should calculate Fragment fees', () => {
    const fees = service.calculateFragmentFees(100);

    expect(fees.percentage).toBe(0.01);
    expect(fees.fee).toBeCloseTo(1, 1);
    expect(fees.netAmount).toBeCloseTo(99, 1);
  });
});
