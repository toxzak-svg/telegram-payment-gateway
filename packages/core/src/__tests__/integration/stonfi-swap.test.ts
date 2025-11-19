import { DexAggregatorService } from '../../services/dex-aggregator.service';

const runDexIntegrationTests = process.env.RUN_DEX_INTEGRATION_TESTS === 'true';
const describeIfEnabled = runDexIntegrationTests ? describe : describe.skip;

if (!runDexIntegrationTests) {
  console.warn('⚠️ Skipping Ston.fi integration tests (set RUN_DEX_INTEGRATION_TESTS=true to enable).');
}

describeIfEnabled('Ston.fi Swap Integration Tests', () => {
  let dexService: DexAggregatorService;

  beforeAll(() => {
    if (process.env.TON_MAINNET === 'true') {
      throw new Error('These tests should only run on testnet!');
    }

    dexService = new DexAggregatorService();
  });

  describe('Rate Fetching', () => {
    it('should fetch rates with Ston.fi included', async () => {
      const quote = await dexService.getBestRate('TON', 'USDT', 1);

      expect(quote).toBeDefined();
      expect(quote.inputAmount).toBe(1);
      expect(quote.outputAmount).toBeGreaterThan(0);
      expect(quote.route).toBeDefined();
    });
  });

  describe('Small Swaps', () => {
    it.skip('should swap 0.1 TON to USDT via Ston.fi', async () => {
      // MANUAL TEST ONLY
      const result = await dexService.executeSwap(
        'stonfi',
        '', // Router doesn't use poolId directly
        'TON',
        'USDT',
        0.1,
        0.09
      );

      expect(result.txHash).toBeDefined();
      expect(result.outputAmount).toBeGreaterThanOrEqual(0.09);
    }, 120000);

    it('should handle slippage on Ston.fi', async () => {
      await expect(
        dexService.executeSwap(
          'stonfi',
          '',
          'TON',
          'USDT',
          0.1,
          999
        )
      ).rejects.toThrow('SLIPPAGE_EXCEEDED');
    });
  });

  describe('Multi-hop Swaps', () => {
    it('should find route for token pairs', async () => {
      const quote = await dexService.getBestRate('TON', 'USDT', 1);
      
      expect(quote.route).toBeDefined();
      expect(quote.route.length).toBeGreaterThanOrEqual(2);
    });
  });
});
