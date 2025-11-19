import DepositMonitorService from '../../services/deposit-monitor.service';
import TonBlockchainService, { TransactionInfo } from '../../services/ton-blockchain.service';
import { WebhookService } from '../../services/webhook.service';

describe('DepositMonitorService', () => {
  const mockDb = {
    oneOrNone: jest.fn(),
    none: jest.fn().mockResolvedValue(undefined)
  } as any;

  const mockTonService: jest.Mocked<Partial<TonBlockchainService>> = {
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    monitorDeposits: jest.fn().mockResolvedValue(jest.fn())
  };

  const mockWebhook: jest.Mocked<Partial<WebhookService>> = {
    queueEvent: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts monitoring and processes confirmed deposits', async () => {
    const service = new DepositMonitorService(
      mockDb,
      mockTonService as unknown as TonBlockchainService,
      mockWebhook as unknown as WebhookService,
      {
      minConfirmations: 1,
      pollIntervalMs: 10
      }
    );

    await service.start();

    expect(mockTonService.initializeWallet).toHaveBeenCalled();
    expect(mockTonService.monitorDeposits).toHaveBeenCalled();

    const tx: TransactionInfo = {
      hash: 'abc',
      from: 'sender',
      to: 'receiver',
      amount: 1.23,
      timestamp: Date.now() / 1000,
      confirmed: true,
      confirmations: 2
    };

    mockDb.oneOrNone.mockResolvedValueOnce({
      id: 'deposit-1',
      user_id: 'user-1',
      payment_id: 'payment-1',
      conversion_id: null,
      deposit_address: tx.to,
      status: 'pending',
      webhook_url: 'https://example.com/webhook'
    });

    await (service as any).handleTransaction(tx);

    expect(mockDb.none).toHaveBeenCalledWith(expect.stringContaining('UPDATE manual_deposits'), expect.any(Array));
    expect(mockWebhook.queueEvent).toHaveBeenCalledWith(
      'user-1',
      'https://example.com/webhook',
      'deposit.confirmed',
      expect.objectContaining({ txHash: 'abc', amountTon: 1.23 })
    );
  });
});
