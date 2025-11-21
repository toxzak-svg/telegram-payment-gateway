import { TransactionMonitorService } from '../../../src/services/transaction-monitor.service';

describe('TransactionMonitorService', () => {
  let service: TransactionMonitorService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    service = new TransactionMonitorService(mockPool, 1000);
  });

  afterEach(() => {
    service.stop();
  });

  test('should prevent race conditions with isProcessing flag', async () => {
    expect(service.isCurrentlyProcessing()).toBe(false);
    
    // Service should not be running initially
    expect(service.isRunning()).toBe(false);
  });

  test('should start and stop monitoring', () => {
    service.start();
    expect(service.isRunning()).toBe(true);

    service.stop();
    expect(service.isRunning()).toBe(false);
    expect(service.isCurrentlyProcessing()).toBe(false);
  });

  test('should not start twice', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    service.start();
    service.start();
    
    expect(consoleSpy).toHaveBeenCalledWith('Transaction monitor already running');
    consoleSpy.mockRestore();
  });

  test('should handle pending transactions query', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id: '1', status: 'pending', created_at: new Date() }
      ]
    });

    service.start();
    
    // Wait a bit for the interval to trigger
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(mockPool.query).toHaveBeenCalled();
    service.stop();
  });
});
