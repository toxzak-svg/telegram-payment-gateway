import axios from 'axios';

export interface DexPoolInfo {
  provider: 'dedust' | 'stonfi';
  poolId: string;
  rate: number;
  liquidity: number;
  fee: number;
  slippage: number;
}

export interface DexQuote {
  inputAmount: number;
  outputAmount: number;
  rate: number;
  pools: DexPoolInfo[];
  bestPool: DexPoolInfo;
  estimatedGas: number;
  route: string[];
}

/**
 * DEX Aggregator Service
 * 
 * Aggregates liquidity from multiple decentralized exchanges:
 * - DeDust.io (Primary TON DEX)
 * - Ston.fi (Secondary TON DEX)
 * 
 * Finds best rates and executes swaps on-chain.
 */
export class DexAggregatorService {
  private dedustApiUrl: string;
  private stonfiApiUrl: string;
  
  constructor() {
    this.dedustApiUrl = process.env.DEDUST_API_URL || 'https://api.dedust.io';
    this.stonfiApiUrl = process.env.STONFI_API_URL || 'https://api.ston.fi';
  }

  /**
   * Get best rate across all DEX providers
   */
  async getBestRate(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<DexQuote> {
    try {
      const [dedustQuote, stonfiQuote] = await Promise.allSettled([
        this.getDeDustQuote(fromToken, toToken, amount),
        this.getStonfiQuote(fromToken, toToken, amount),
      ]);

      const quotes: DexQuote[] = [];

      if (dedustQuote.status === 'fulfilled') {
        quotes.push(dedustQuote.value);
      } else {
        console.warn('DeDust quote failed:', dedustQuote.reason);
      }

      if (stonfiQuote.status === 'fulfilled') {
        quotes.push(stonfiQuote.value);
      } else {
        console.warn('Ston.fi quote failed:', stonfiQuote.reason);
      }

      if (quotes.length === 0) {
        throw new Error('All DEX providers failed to provide quotes');
      }

      // Return quote with highest output amount
      return quotes.sort((a, b) => b.outputAmount - a.outputAmount)[0];
    } catch (error: any) {
      console.error('DEX aggregator error:', error);
      throw new Error(`Failed to get DEX quote: ${error.message}`);
    }
  }

  /**
   * Query DeDust DEX for rates
   */
  private async getDeDustQuote(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<DexQuote> {
    try {
      const response = await axios.get(`${this.dedustApiUrl}/v1/quote`, {
        params: {
          from: fromToken,
          to: toToken,
          amount: amount.toString(),
        },
        timeout: 5000,
      });

      return {
        inputAmount: amount,
        outputAmount: parseFloat(response.data.outputAmount),
        rate: parseFloat(response.data.rate),
        pools: response.data.pools?.map((p: any) => ({
          provider: 'dedust' as const,
          poolId: p.poolAddress,
          rate: parseFloat(p.rate),
          liquidity: parseFloat(p.liquidity),
          fee: parseFloat(p.fee),
          slippage: parseFloat(p.slippage || '0.005'),
        })) || [],
        bestPool: {
          provider: 'dedust' as const,
          poolId: response.data.poolAddress || response.data.pools?.[0]?.poolAddress,
          rate: parseFloat(response.data.rate),
          liquidity: parseFloat(response.data.liquidity || '0'),
          fee: parseFloat(response.data.fee || '0.003'),
          slippage: parseFloat(response.data.slippage || '0.005'),
        },
        estimatedGas: parseFloat(response.data.estimatedGas || '0.05'),
        route: response.data.route || [fromToken, toToken],
      };
    } catch (error: any) {
      console.error('DeDust API error:', error.message);
      throw new Error(`DeDust API failed: ${error.message}`);
    }
  }

  /**
   * Query Ston.fi DEX for rates
   */
  private async getStonfiQuote(
    fromToken: string,
    toToken: string,
    amount: number
  ): Promise<DexQuote> {
    try {
      const response = await axios.get(`${this.stonfiApiUrl}/v1/swap/simulate`, {
        params: {
          offer_address: fromToken,
          ask_address: toToken,
          units: amount.toString(),
        },
        timeout: 5000,
      });

      return {
        inputAmount: amount,
        outputAmount: parseFloat(response.data.ask_units),
        rate: parseFloat(response.data.swap_rate),
        pools: [{
          provider: 'stonfi' as const,
          poolId: response.data.pool_address,
          rate: parseFloat(response.data.swap_rate),
          liquidity: parseFloat(response.data.liquidity || '0'),
          fee: parseFloat(response.data.fee_percent || '0.003'),
          slippage: parseFloat(response.data.slippage_tolerance || '0.005'),
        }],
        bestPool: {
          provider: 'stonfi' as const,
          poolId: response.data.pool_address,
          rate: parseFloat(response.data.swap_rate),
          liquidity: parseFloat(response.data.liquidity || '0'),
          fee: parseFloat(response.data.fee_percent || '0.003'),
          slippage: parseFloat(response.data.slippage_tolerance || '0.005'),
        },
        estimatedGas: parseFloat(response.data.estimated_gas || '0.05'),
        route: response.data.route || [fromToken, toToken],
      };
    } catch (error: any) {
      console.error('Ston.fi API error:', error.message);
      throw new Error(`Ston.fi API failed: ${error.message}`);
    }
  }

  /**
   * Execute swap through selected DEX
   */
  async executeSwap(
    provider: 'dedust' | 'stonfi',
    poolId: string,
    fromToken: string,
    toToken: string,
    amount: number,
    minOutput: number
  ): Promise<{ txHash: string; outputAmount: number }> {
    if (provider === 'dedust') {
      return this.executeDeDustSwap(poolId, fromToken, toToken, amount, minOutput);
    } else {
      return this.executeStonfiSwap(poolId, fromToken, toToken, amount, minOutput);
    }
  }

  private async executeDeDustSwap(
    poolId: string,
    fromToken: string,
    toToken: string,
    amount: number,
    minOutput: number
  ): Promise<{ txHash: string; outputAmount: number }> {
    // TODO: Implement actual DeDust swap execution via TON smart contract
    // This requires:
    // 1. Initialize TonWeb client
    // 2. Build swap transaction
    // 3. Sign with wallet private key
    // 4. Send transaction to blockchain
    // 5. Wait for confirmation
    console.warn('DeDust swap execution not yet implemented');
    throw new Error('DeDust swap execution requires TON smart contract integration');
  }

  private async executeStonfiSwap(
    poolId: string,
    fromToken: string,
    toToken: string,
    amount: number,
    minOutput: number
  ): Promise<{ txHash: string; outputAmount: number }> {
    // TODO: Implement actual Ston.fi swap execution via TON smart contract
    // This requires:
    // 1. Initialize TonWeb client
    // 2. Build swap transaction
    // 3. Sign with wallet private key
    // 4. Send transaction to blockchain
    // 5. Wait for confirmation
    console.warn('Ston.fi swap execution not yet implemented');
    throw new Error('Ston.fi swap execution requires TON smart contract integration');
  }
}

export default DexAggregatorService;
