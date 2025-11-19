import SettlementService from '../../services/settlement.service';
import { WebhookService } from '../../services/webhook.service';

describe('SettlementService', () => {
  const mockDb = {
    any: jest.fn(),
    none: jest.fn().mockResolvedValue(undefined),
    one: jest.fn()
  } as any;

  const mockWebhook: jest.Mocked<Partial<WebhookService>> = {
    queueEvent: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes completed conversions into settlements', async () => {
    const service = new SettlementService(
      mockDb,
      mockWebhook as unknown as WebhookService,
      {
      batchSize: 1,
      tonUsdRate: 5
      }
    );

    mockDb.any
      .mockResolvedValueOnce([
        {
          id: 'conversion-1',
          user_id: 'user-1',
          target_amount: 10,
          target_currency: 'TON',
          payment_ids: ['payment-1'],
          settlement_id: null,
          webhook_url: 'https://example.com/webhook'
        }
      ])
      .mockResolvedValueOnce([
        {
          settlement_id: 'settlement-1',
          user_id: 'user-1',
          conversion_id: 'conversion-1',
          fiat_amount: 55,
          payment_ids: ['payment-1'],
          webhook_url: 'https://example.com/webhook'
        }
      ]);

    mockDb.one.mockResolvedValueOnce({
      id: 'settlement-1',
      user_id: 'user-1',
      conversion_id: 'conversion-1',
      fiat_amount: 55,
      fiat_currency: 'USD',
      exchange_platform: 'p2p-liquidity',
      bank_account_id: null,
      recipient_info: '{}',
      status: 'pending',
      created_at: new Date().toISOString()
    });

    await service.processCycle();

    expect(mockDb.none).toHaveBeenCalled();
    expect(mockWebhook.queueEvent).toHaveBeenCalledWith(
      'user-1',
      'https://example.com/webhook',
      'settlement.completed',
      expect.objectContaining({ conversionId: 'conversion-1' })
    );
  });
});
