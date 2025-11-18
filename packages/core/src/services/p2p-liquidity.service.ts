import { Pool } from 'pg';
import { DexAggregatorService } from './dex-aggregator.service';
import { StarsP2PService } from './stars-p2p.service';

export interface LiquiditySource {
  type: 'p2p' | 'dex';
  provider?: 'dedust' | 'stonfi';
  rate: number;
  liquidity: number;
  fee: number;
  executionTime: number; // seconds
}

export interface ConversionRoute {
  sources: LiquiditySource[];
  totalRate: number;
  totalFee: number;
  estimatedTime: number;
  confidence: number; // 0-1 score
}

/**
 * P2P Liquidity Service
 * 
 * Intelligently routes conversions through:
 * 1. P2P order book (stars_orders table)
 * 2. DEX liquidity pools (DeDust, Ston.fi)
 * 
 * Selects best route based on:
 * - Output amount (highest net return)
 * - Execution time
 * - Confidence/reliability
 */
export class P2PLiquidityService {
  private pool: Pool;
  private dexAggregator: DexAggregatorService;
  private p2pService: StarsP2PService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.dexAggregator = new DexAggregatorService();
    // Pass pool with type assertion for StarsP2PService compatibility
    this.p2pService = new StarsP2PService(pool as any);
  }

  /**
   * Find best conversion route (P2P or DEX)
   */
  async findBestRoute(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<ConversionRoute> {
    try {
      // Query both P2P order book and DEX pools in parallel
      const [p2pOrders, dexQuote] = await Promise.allSettled([
        this.getP2PLiquidity(fromCurrency, toCurrency, amount),
        this.dexAggregator.getBestRate(fromCurrency, toCurrency, amount),
      ]);

      const routes: ConversionRoute[] = [];

      // P2P route (if available)
      if (p2pOrders.status === 'fulfilled' && p2pOrders.value.totalLiquidity >= amount) {
        routes.push({
          sources: [{
            type: 'p2p',
            rate: p2pOrders.value.averageRate,
            liquidity: p2pOrders.value.totalLiquidity,
            fee: 0.001, // 0.1% P2P fee
            executionTime: 60, // ~1 minute
          }],
          totalRate: p2pOrders.value.averageRate,
          totalFee: amount * 0.001,
          estimatedTime: 60,
          confidence: 0.95,
        });
      }

      // DEX route (if available)
      if (dexQuote.status === 'fulfilled') {
        routes.push({
          sources: [{
            type: 'dex',
            provider: dexQuote.value.bestPool.provider,
            rate: dexQuote.value.rate,
            liquidity: dexQuote.value.bestPool.liquidity,
            fee: dexQuote.value.bestPool.fee,
            executionTime: 30, // ~30 seconds
          }],
          totalRate: dexQuote.value.rate,
          totalFee: dexQuote.value.bestPool.fee,
          estimatedTime: 30,
          confidence: 0.98,
        });
      }

      if (routes.length === 0) {
        throw new Error('No liquidity routes available for conversion');
      }

      // Return best route (highest net output)
      return routes.sort((a, b) => {
        const aOutput = amount * a.totalRate - a.totalFee;
        const bOutput = amount * b.totalRate - b.totalFee;
        return bOutput - aOutput;
      })[0];
    } catch (error: any) {
      console.error('Error finding best route:', error);
      throw new Error(`Failed to find conversion route: ${error.message}`);
    }
  }

  /**
   * Execute conversion through best available route
   */
  async executeConversion(
    conversionId: string,
    route: ConversionRoute
  ): Promise<{ success: boolean; txHash?: string; dexPoolId?: string; dexProvider?: string; error?: string }> {
    const source = route.sources[0];

    try {
      if (source.type === 'p2p') {
        const result = await this.executeP2PConversion(conversionId);
        return {
          success: true,
          dexProvider: 'p2p',
          ...result,
        };
      } else {
        const result = await this.executeDexConversion(conversionId, source);
        return {
          success: true,
          dexProvider: source.provider,
          ...result,
        };
      }
    } catch (error: any) {
      console.error('Conversion execution error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get P2P order book liquidity
   */
  private async getP2PLiquidity(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ) {
    try {
      // Query P2P order book for available sell orders
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as order_count,
          SUM(stars_amount) as total_liquidity,
          AVG(CAST(rate AS DECIMAL)) as average_rate
        FROM stars_orders
        WHERE type = 'sell' 
          AND status = 'open'
          AND stars_amount >= $1
      `, [amount]);

      return {
        totalLiquidity: parseFloat(result.rows[0]?.total_liquidity || '0'),
        averageRate: parseFloat(result.rows[0]?.average_rate || '0'),
        orderCount: parseInt(result.rows[0]?.order_count || '0'),
      };
    } catch (error: any) {
      console.error('P2P liquidity query error:', error);
      return {
        totalLiquidity: 0,
        averageRate: 0,
        orderCount: 0,
      };
    }
  }

  /**
   * Execute P2P order matching and conversion
   */
  private async executeP2PConversion(conversionId: string) {
    try {
      // Get conversion details
      const conversion = await this.pool.query(
        'SELECT * FROM conversions WHERE id = $1',
        [conversionId]
      );

      if (!conversion.rows[0]) {
        throw new Error('Conversion not found');
      }

      const { source_amount, user_id } = conversion.rows[0];

      // Create a buy order for this conversion
      // This will automatically trigger P2P matching
      const rate = '0.000015'; // Example rate: 1 Star = 0.000015 TON
      const tonAmount = (source_amount * parseFloat(rate)).toString();

      await this.p2pService.createBuyOrder(user_id, tonAmount, rate);

      // TODO: Wait for order matching and update conversion status
      // For now, return placeholder
      return {
        txHash: undefined, // Will be set when atomic swap completes
        dexPoolId: 'p2p-order-book',
      };
    } catch (error: any) {
      console.error('P2P conversion execution error:', error);
      throw new Error(`P2P conversion failed: ${error.message}`);
    }
  }

  /**
   * Execute DEX swap
   */
  private async executeDexConversion(conversionId: string, source: LiquiditySource) {
    try {
      // Get conversion details
      const conversion = await this.pool.query(
        'SELECT * FROM conversions WHERE id = $1',
        [conversionId]
      );

      if (!conversion.rows[0]) {
        throw new Error('Conversion not found');
      }

      const { source_amount, source_currency, target_currency } = conversion.rows[0];

      // Execute DEX swap
      const result = await this.dexAggregator.executeSwap(
        source.provider as 'dedust' | 'stonfi',
        'pool-id', // Will be determined by best quote
        source_currency,
        target_currency,
        source_amount,
        source_amount * source.rate * 0.95 // 5% slippage tolerance
      );

      return {
        txHash: result.txHash,
        dexPoolId: 'pool-id', // From best quote
      };
    } catch (error: any) {
      console.error('DEX conversion execution error:', error);
      throw new Error(`DEX conversion failed: ${error.message}`);
    }
  }

  /**
   * Get all available liquidity sources for display
   */
  async getAllLiquiditySources(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<LiquiditySource[]> {
    const sources: LiquiditySource[] = [];

    try {
      // Get P2P liquidity
      const p2pLiquidity = await this.getP2PLiquidity(fromCurrency, toCurrency, amount);
      if (p2pLiquidity.totalLiquidity > 0) {
        sources.push({
          type: 'p2p',
          rate: p2pLiquidity.averageRate,
          liquidity: p2pLiquidity.totalLiquidity,
          fee: 0.001,
          executionTime: 60,
        });
      }
    } catch (error) {
      console.warn('Failed to fetch P2P liquidity:', error);
    }

    try {
      // Get DEX quotes
      const dexQuote = await this.dexAggregator.getBestRate(fromCurrency, toCurrency, amount);
      sources.push({
        type: 'dex',
        provider: dexQuote.bestPool.provider,
        rate: dexQuote.rate,
        liquidity: dexQuote.bestPool.liquidity,
        fee: dexQuote.bestPool.fee,
        executionTime: 30,
      });
    } catch (error) {
      console.warn('Failed to fetch DEX quotes:', error);
    }

    return sources;
  }
}

export default P2PLiquidityService;
