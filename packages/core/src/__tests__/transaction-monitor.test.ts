import { TransactionMonitorService } from '../services/transaction-monitor.service';
import TonBlockchainService from '../services/ton-blockchain.service';

describe('TransactionMonitorService', () => {
  let monitor: TransactionMonitorService;
  let mockDb: any;
  let mockTonService: any;

  beforeEach(() => {
    mockDb = {
      any: jest.fn(),
      tx: jest.fn((cb) => cb({
        none: jest.fn(),
        oneOrNone: jest.fn().mockResolvedValue(null)
      })),
      none: jest.fn()
    };

    mockTonService = {
      getTransaction: jest.fn()
    };

    monitor = new TransactionMonitorService(mockDb, mockTonService);
  });

  test('should process confirmed transactions', async () => {
    const conversion = {
      id: 'conv-123',
      dex_tx_hash: 'hash-123',
      status: 'phase2_committed'
    };

    mockDb.any.mockResolvedValue([conversion]);
    mockTonService.getTransaction.mockResolvedValue({
      hash: 'hash-123',
      confirmed: true,
      success: true
    });

    await (monitor as any).checkPendingTransactions();

    expect(mockTonService.getTransaction).toHaveBeenCalledWith('hash-123');
    expect(mockDb.tx).toHaveBeenCalled();
  });

  test('should handle failed transactions', async () => {
    const conversion = {
      id: 'conv-456',
      dex_tx_hash: 'hash-456',
      status: 'phase2_committed'
    };

    mockDb.any.mockResolvedValue([conversion]);
    mockTonService.getTransaction.mockResolvedValue({
      hash: 'hash-456',
      confirmed: true,
      success: false,
      exitCode: 123
    });

    await (monitor as any).checkPendingTransactions();

    expect(mockDb.none).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE conversions"),
      expect.arrayContaining([expect.stringContaining("exit code: 123"), 'conv-456'])
    );
  });
});
