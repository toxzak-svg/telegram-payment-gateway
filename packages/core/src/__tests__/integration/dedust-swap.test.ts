import { DexAggregatorService } from '../../services/dex-aggregator.service';
import { DexErrorCode } from '../../services/dex-error-handler';

const runDexIntegrationTests = process.env.RUN_DEX_INTEGRATION_TESTS === 'true';
const describeIfEnabled = runDexIntegrationTests ? describe : describe.skip;

if (!runDexIntegrationTests) {
  console.warn('⚠️ Skipping DeDust integration tests (set RUN_DEX_INTEGRATION_TESTS=true to enable).');
}

describeIfEnabled('DeDust Swap Integration Tests', () => {
  let dexService: DexAggregatorService;

  beforeAll(() => {
    // Ensure we're on testnet
    if (process.env.TON_MAINNET === 'true') {
      throw new Error('These tests should only run on testnet!');
    }

    dexService = new DexAggregatorService();
  });

  describe('Wallet Initialization', () => {
    it('should initialize wallet from mnemonic', async () => {
      await expect(dexService.initializeWallet()).resolves.not.toThrow();
    });

    it('should throw error if mnemonic not set', async () => {
      const originalMnemonic = process.env.TON_WALLET_MNEMONIC;
      delete process.env.TON_WALLET_MNEMONIC;

      const service = new DexAggregatorService();
      await expect(service.initializeWallet()).rejects.toThrow('TON_WALLET_MNEMONIC');

      process.env.TON_WALLET_MNEMONIC = originalMnemonic;
    });
  });

  describe('Rate Fetching', () => {
    it('should fetch best rate across DEXes', async () => {
      const quote = await dexService.getBestRate('TON', 'USDT', 1);

      expect(quote).toBeDefined();
      expect(quote.inputAmount).toBe(1);
      expect(quote.outputAmount).toBeGreaterThan(0);
      expect(quote.rate).toBeGreaterThan(0);
      expect(quote.bestPool).toBeDefined();
      expect(quote.bestPool.provider).toMatch(/dedust|stonfi/);
    });
  });

  describe('Small Swaps (< 1 TON)', () => {
    it.skip('should swap 0.1 TON to USDT on testnet', async () => {
      // MANUAL TEST ONLY - requires testnet TON
      const result = await dexService.executeSwap(
        'dedust',
        process.env.DEDUST_TEST_POOL_ID || 'EQD_test_pool',
        'TON',
        'USDT',
        0.1,
        0.09 // 10% slippage for testing
      );

      expect(result.txHash).toBeDefined();
      expect(result.outputAmount).toBeGreaterThan(0);
      expect(result.outputAmount).toBeGreaterThanOrEqual(0.09);
      expect(result.gasUsed).toBeLessThan(0.1);
    }, 120000); // 2 minute timeout

    it('should handle slippage protection', async () => {
      await expect(
        dexService.executeSwap(
          'dedust',
          'EQD_test_pool',
          'TON',
          'USDT',
          0.1,
          999 // Unrealistic minimum
        )
      ).rejects.toThrow('SLIPPAGE_EXCEEDED');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid pool address', async () => {
      await expect(
        dexService.executeSwap(
          'dedust',
          'INVALID_ADDRESS',
          'TON',
          'USDT',
          0.1,
          0.09
        )
      ).rejects.toThrow();
    });

    it('should handle insufficient balance', async () => {
      await expect(
        dexService.executeSwap(
          'dedust',
          'EQD_test_pool',
          'TON',
          'USDT',
          10000, // Huge amount
          9000
        )
      ).rejects.toThrow('INSUFFICIENT_FUNDS');
    });
  });

  describe('Gas Estimation', () => {
    it('should estimate reasonable gas fees', async () => {
      // Gas should be between 0.01 and 0.2 TON
      const service = new DexAggregatorService();
      await service.initializeWallet();
      
      // Access private method through any
      const gasEstimate = await (service as any).estimateGasFee('swap');
      const gasInTon = Number(gasEstimate) / 1e9;
      
      expect(gasInTon).toBeGreaterThan(0.01);
      expect(gasInTon).toBeLessThan(0.2);
    });
  });
});
