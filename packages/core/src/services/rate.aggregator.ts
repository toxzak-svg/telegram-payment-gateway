import axios from 'axios';
import Redis from 'ioredis';

export interface RateSource {
  source: string;
  value: number;
  timestamp: number;
}

export interface AggregatedRate {
  bestRate: number;
  averageRate: number;
  rates: RateSource[];
  sourceCurrency: string;
  targetCurrency: string;
  timestamp: number;
}

/**
 * Rate Aggregator Service
 * 
 * Fetches exchange rates from multiple sources and calculates weighted average
 * Sources: CoinGecko, DexScreener, CoinMarketCap
 */
export class RateAggregatorService {
  private redis: Redis;
  private sources = {
    coingecko: 'https://api.coingecko.com/api/v3',
    dexscreener: 'https://api.dexscreener.com/latest/dex/tokens',
    coinmarketcap: process.env.CMC_API_KEY
      ? 'https://pro-api.coinmarketcap.com/v1'
      : null,
  };

  // Weighted average configuration (favors on-chain liquidity)
  private weights = {
    dexscreener: 0.4, // Real DEX prices
    coingecko: 0.35, // Aggregated markets
    coinmarketcap: 0.25, // Reference data
  } as const;

  private defaultWeight = 0.25;
  private simulationMode: boolean;

  constructor() {
    const simulationFlag = process.env.RATE_SIMULATION_MODE ?? (process.env.NODE_ENV === 'test' ? 'true' : 'false');
    this.simulationMode = simulationFlag === 'true';
    if (this.simulationMode) {
      console.log('🧪 RateAggregatorService running in simulation mode');
    }
    // In simulation mode use a lightweight in-memory stub to avoid external
    // Redis connectivity causing test timeouts. In production/tests when
    // not in simulation we connect to configured Redis.
    // Try to construct a Redis client. In test environments where `ioredis`
    // is mocked, the returned instance will have jest mock functions which
    // tests can spy on. When running in simulation mode in non-test
    // environments and no mocked client is available, fall back to a
    // lightweight in-memory stub to avoid external network hangs.
    const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const isMockedGet = !!(client as any)?.get?._isMockFunction;

    if (this.simulationMode && !isMockedGet) {
      this.redis = {
        get: async (_key: string) => null,
        set: async (_key: string, _val: any, _mode?: any, _ttl?: any) => {},
      } as unknown as Redis;
    } else {
      this.redis = client;
    }
  }

  /**
   * Get aggregated exchange rate from multiple sources
   * 
   * @param sourceCurrency - Source currency (e.g., "TON", "STARS")
   * @param targetCurrency - Target currency (e.g., "USD", "EUR")
   * @returns AggregatedRate with weighted average and individual sources
   */
  async getAggregatedRate(
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<AggregatedRate> {
    const cacheKey = `rate:${sourceCurrency}:${targetCurrency}`;
    const cachedRate = await this.redis.get(cacheKey);
    if (cachedRate) {
      return JSON.parse(cachedRate);
    }

    console.log(`📊 Fetching rates: ${sourceCurrency} → ${targetCurrency}`);

    // Use simulation mode if enabled
    if (this.simulationMode) {
      const rate = await this.getSimulatedRate(sourceCurrency, targetCurrency);
      await this.redis.set(cacheKey, JSON.stringify(rate), 'EX', 300);
      return rate;
    }

    try {
      // Fetch from all sources in parallel
      const [cgRate, dexRate, cmcRate] = await Promise.all([
        this.getCoinGeckoRate(sourceCurrency, targetCurrency),
        this.getDexScreenerRate(sourceCurrency, targetCurrency),
        this.getCoinMarketCapRate(sourceCurrency, targetCurrency),
      ]);

      // Filter out null results
      const rates: RateSource[] = [cgRate, dexRate, cmcRate].filter(
        (r): r is RateSource => r !== null
      );

      if (rates.length === 0) {
        throw new Error('No rate data available from any source');
      }

      console.log('✅ Rates fetched:', rates);

      // Calculate weighted average
      const { sum: weightedSum, weightSum } = rates.reduce(
        (acc, rate) => {
          const weight = this.weights[rate.source as keyof typeof this.weights] ?? this.defaultWeight;
          return {
            sum: acc.sum + rate.value * weight,
            weightSum: acc.weightSum + weight,
          };
        },
        { sum: 0, weightSum: 0 }
      );

      const averageRate = weightedSum / weightSum;
      const bestRate = Math.max(...rates.map(r => r.value));

      const result: AggregatedRate = {
        bestRate,
        averageRate,
        rates,
        sourceCurrency,
        targetCurrency,
        timestamp: Date.now(),
      };

      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // Cache for 5 minutes

      return result;
    } catch (error) {
      console.error('❌ Rate aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Fetch rate from CoinGecko API
   */
  private async getCoinGeckoRate(
    source: string,
    target: string
  ): Promise<RateSource | null> {
    try {
      const sourceId = this.getCoinGeckoId(source);
      const targetId = target.toLowerCase();

      const url = `${this.sources.coingecko}/simple/price?ids=${sourceId}&vs_currencies=${targetId}`;
      const response = await axios.get(url, { timeout: 5000 });

      const rate = response.data[sourceId]?.[targetId];
      
      if (!rate) {
        console.warn('⚠️ CoinGecko: No rate data');
        return null;
      }

      return {
        source: 'coingecko',
        value: rate,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ CoinGecko fetch failed:', error);
      return null;
    }
  }

  /**
   * Fetch rate from DexScreener API
   */
  private async getDexScreenerRate(
    source: string,
    target: string
  ): Promise<RateSource | null> {
    try {
      // DexScreener requires token address - this is a simplified implementation
      // In production, map currency codes to actual token addresses
      const tokenAddress = this.getDexScreenerAddress(source);
      
      if (!tokenAddress) {
        console.warn('⚠️ DexScreener: No token address mapping');
        return null;
      }

      const url = `${this.sources.dexscreener}/${tokenAddress}`;
      const response = await axios.get(url, { timeout: 5000 });

      const pair = response.data.pairs?.[0];
      const rate = parseFloat(pair?.priceUsd);

      if (!rate || isNaN(rate)) {
        console.warn('⚠️ DexScreener: No rate data');
        return null;
      }

      // Convert to target currency if needed (simplified)
      const finalRate = target.toUpperCase() === 'USD' ? rate : rate;

      return {
        source: 'dexscreener',
        value: finalRate,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ DexScreener fetch failed:', error);
      return null;
    }
  }

  /**
   * Fetch rate from CoinMarketCap API (requires API key)
   */
  private async getCoinMarketCapRate(
    source: string,
    target: string
  ): Promise<RateSource | null> {
    if (!this.sources.coinmarketcap) {
      console.warn('⚠️ CoinMarketCap: API key not configured');
      return null;
    }

    try {
      const url = `${this.sources.coinmarketcap}/cryptocurrency/quotes/latest`;
      const response = await axios.get(url, {
        params: {
          symbol: source.toUpperCase(),
          convert: target.toUpperCase(),
        },
        headers: {
          'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY!,
        },
        timeout: 5000,
      });

      const data = response.data.data[source.toUpperCase()];
      const rate = data?.quote[target.toUpperCase()]?.price;

      if (!rate) {
        console.warn('⚠️ CoinMarketCap: No rate data');
        return null;
      }

      return {
        source: 'coinmarketcap',
        value: rate,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('❌ CoinMarketCap fetch failed:', error);
      return null;
    }
  }

  /**
   * Map currency codes to CoinGecko IDs
   */
  private getCoinGeckoId(currency: string): string {
    const mapping: Record<string, string> = {
      TON: 'the-open-network',
      BTC: 'bitcoin',
      ETH: 'ethereum',
      USDT: 'tether',
      // Add more as needed
    };

    return mapping[currency.toUpperCase()] || currency.toLowerCase();
  }

  /**
   * Map currency codes to DexScreener token addresses
   */
  private getDexScreenerAddress(currency: string): string | null {
    const mapping: Record<string, string> = {
      // TON mainnet addresses - update with actual addresses
      TON: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT', // Placeholder
      // Add more token addresses
    };

    return mapping[currency.toUpperCase()] || null;
  }

  /**
   * Get rate for specific currency pair with caching
   */
  async getRateWithCache(
    source: string,
    target: string,
    cacheDuration: number = 60 // 1 minute default
  ): Promise<number> {
    const cacheKey = `rate:${source}:${target}`;
    const cachedRate = await this.redis.get(cacheKey);

    if (cachedRate) {
      return parseFloat(cachedRate);
    }

    const rate = await this.getAggregatedRate(source, target);
    if (rate.averageRate > 0) {
      await this.redis.set(cacheKey, rate.averageRate, 'EX', cacheDuration);
    }
    
    return rate.averageRate;
  }

  /**
   * Get simulated rate data for testing
   * Note: These rates are test fixtures and do not reflect current market values
   */
  private getSimulatedRate(
    sourceCurrency: string,
    targetCurrency: string
  ): AggregatedRate {
    // Simulated rates for common pairs (test fixtures - not real market data)
    const rateMap: Record<string, Record<string, number>> = {
      TON: {
        USD: 2.15,
        EUR: 1.98,
        GBP: 1.72,
      },
      BTC: {
        USD: 45000,
        EUR: 41500,
        GBP: 36000,
      },
      ETH: {
        USD: 2800,
        EUR: 2580,
        GBP: 2240,
      },
    };

    const baseRate = rateMap[sourceCurrency.toUpperCase()]?.[targetCurrency.toUpperCase()] || 1.0;

    // Simulate slight variations from different sources
    const rates: RateSource[] = [
      {
        source: 'coingecko',
        value: baseRate * 1.005, // +0.5%
        timestamp: Date.now(),
      },
      {
        source: 'dexscreener',
        value: baseRate * 0.998, // -0.2%
        timestamp: Date.now(),
      },
      {
        source: 'coinmarketcap',
        value: baseRate * 1.002, // +0.2%
        timestamp: Date.now(),
      },
    ];

    const bestRate = Math.min(...rates.map((r) => r.value));

    // Calculate weighted average
    const { sum: weightedSum, weightSum } = rates.reduce(
      (acc, rate) => {
        const weight = this.weights[rate.source as keyof typeof this.weights] ?? this.defaultWeight;
        return {
          sum: acc.sum + rate.value * weight,
          weightSum: acc.weightSum + weight,
        };
      },
      { sum: 0, weightSum: 0 }
    );

    console.log(`🧪 Simulated rates for ${sourceCurrency} → ${targetCurrency}:`, rates);

    return {
      bestRate,
      averageRate: weightSum > 0 ? weightedSum / weightSum : weightedSum,
      rates,
      sourceCurrency,
      targetCurrency,
      timestamp: Date.now(),
    };
  }
}

export default RateAggregatorService;
