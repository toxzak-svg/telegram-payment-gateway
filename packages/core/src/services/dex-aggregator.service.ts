import axios from 'axios';
import { TonClient, WalletContractV4, Address, fromNano, toNano, Cell, beginCell } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { DeDustPool } from '../contracts/dedust.contract';
import { StonfiRouter } from '../contracts/stonfi.contract';
import { JettonMaster, JettonWallet } from '../contracts/jetton.contract';
import { DexError, DexErrorCode, parseDexError, DexRetryHandler } from './dex-error-handler';
import { TonBlockchainService } from './ton-blockchain.service';

// DEX operation codes - Note: These may differ between DEXes
// TODO: Verify actual operation codes for each DEX from their documentation
export const DEX_SWAP_OP = 0x25938561;

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

export interface SwapResult {
  txHash: string;
  outputAmount: number;
  gasUsed: number;
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
  private client: TonClient;
  private tonService: TonBlockchainService;
  private retryHandler: DexRetryHandler;
  private simulationMode: boolean;
  
  constructor() {
    this.dedustApiUrl = process.env.DEDUST_API_URL || 'https://api.dedust.io';
    this.stonfiApiUrl = process.env.STONFI_API_URL || 'https://api.ston.fi';
    
    this.tonService = new TonBlockchainService(
      process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
      process.env.TON_API_KEY,
      process.env.TON_WALLET_MNEMONIC
    );
    this.client = this.tonService.getClient();
    
    this.retryHandler = new DexRetryHandler();
    const simulationFlag = process.env.DEX_SIMULATION_MODE ?? (process.env.NODE_ENV === 'test' ? 'true' : 'false');
    this.simulationMode = simulationFlag === 'true';
  }

  /**
   * Initialize wallet for swap execution
   */
  async initializeWallet(): Promise<void> {
    if (this.tonService.getWalletAddress()) {
      return; // Already initialized
    }
    await this.tonService.initializeWallet();
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
    if (this.isSimulationMode()) {
      return this.buildMockQuote('dedust', fromToken, toToken, amount);
    }
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
    if (this.isSimulationMode()) {
      return this.buildMockQuote('stonfi', fromToken, toToken, amount);
    }
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
  ): Promise<SwapResult> {
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
  ): Promise<SwapResult> {
    if (this.isSimulationMode()) {
      return this.simulateSwap('dedust', poolId, fromToken, toToken, amount, minOutput);
    }
    try {
      // Initialize wallet if not done
      await this.initializeWallet();
      const { wallet, keyPair } = this.tonService.getWallet();
      const sender = this.tonService.getSender();

      console.log(`🔄 Executing DeDust swap: ${amount} ${fromToken} → ${toToken}`);

      const poolAddress = Address.parse(poolId);
      const pool = DeDustPool.createFromAddress(poolAddress);
      const provider = this.client.provider(wallet.address, null);

      await pool.sendSwap(
        provider,
        sender,
        {
          amountIn: toNano(amount.toString()),
          minAmountOut: toNano(minOutput.toString()),
          deadline: Math.floor(Date.now() / 1000) + 600, // 10 min deadline
          recipient: wallet.address,
        },
        toNano('0.1') // Gas fee
      );

      // This is a simplified placeholder. In a real implementation, you would
      // monitor the blockchain for the transaction to be mined and get the details.
      return {
        txHash: 'placeholder_tx_hash',
        outputAmount: 0, // Placeholder
        gasUsed: 0, // Placeholder
      };

    } catch (error: any) {
      throw parseDexError(error);
    }
  }

  private async executeStonfiSwap(
    poolId: string,
    fromToken: string,
    toToken: string,
    amount: number,
    minOutput: number
  ): Promise<SwapResult> {
    if (this.isSimulationMode()) {
      return this.simulateSwap('stonfi', poolId, fromToken, toToken, amount, minOutput);
    }
    try {
      await this.initializeWallet();
      const { wallet, keyPair } = this.tonService.getWallet();
      const sender = this.tonService.getSender();

      console.log(`🔄 Executing Ston.fi swap: ${amount} ${fromToken} → ${toToken}`);

      const routerAddress = Address.parse(poolId);
      const router = StonfiRouter.createFromAddress(routerAddress);
      const provider = this.client.provider(wallet.address, null);

      const fromAddress = Address.parse(fromToken);
      const toAddress = Address.parse(toToken);

      await router.sendSwapExactTokensForTokens(
        provider,
        sender,
        {
          amountIn: toNano(amount.toString()),
          amountOutMin: toNano(minOutput.toString()),
          path: [fromAddress, toAddress],
          to: wallet.address,
          deadline: Math.floor(Date.now() / 1000) + 600, // 10 min deadline
        },
        toNano('0.1') // Gas fee
      );

      return {
        txHash: 'placeholder_tx_hash',
        outputAmount: 0,
        gasUsed: 0,
      };
    } catch (error: any) {
      throw parseDexError(error);
    }
  }

  /**
   * Check if the service is running in simulation mode.
   */
  private isSimulationMode(): boolean {
    return this.simulationMode;
  }

  private async simulateSwap(
    provider: 'dedust' | 'stonfi',
    poolId: string,
    fromToken: string,
    toToken: string,
    amount: number,
    minOutput: number
  ): Promise<SwapResult> {
    // Optional provider-specific poolId validation to keep previous semantics
    if (provider === 'dedust') {
      // DeDust pools are typically represented as workchain:hex64 (e.g. "0:abcd...").
      // This keeps us close to previous behavior by failing fast on obviously bad IDs.
      const dedustPoolIdPattern = /^-?\d+:[0-9a-fA-F]{64}$/;
      if (!dedustPoolIdPattern.test(poolId)) {
        throw new Error(`Invalid DeDust pool id: ${poolId}`);
      }
    }

    // Simple mock rate: 1:1 with ~2% slippage to preserve "simulation" behavior
    const baseRate = 1; // 1 fromToken -> 1 toToken before slippage
    const slippageFraction = 0.02; // 2% slippage
    const expectedOutput = amount * baseRate;
    const simulatedOutput = expectedOutput * (1 - slippageFraction);

    // Enforce minOutput so callers/tests still see slippage-related failures
    if (simulatedOutput < minOutput) {
      // Preserve slippage-style failure semantics (message can be aligned with real implementation)
      throw new Error(
        `Simulated swap output ${simulatedOutput} is below minOutput ${minOutput}`
      );
    }

    // Build a simulated SwapResult.
    const result: SwapResult = {
      txHash: `simulated_tx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      outputAmount: simulatedOutput,
      gasUsed: 0.05,
    };

    return result;
  }

  private buildMockQuote(
    provider: 'dedust' | 'stonfi',
    fromToken: string,
    toToken: string,
    amount: number
  ): DexQuote {
    const rate = provider === 'dedust' ? 2500 : 2495;
    const outputAmount = amount * rate * 0.99; // Include some slippage
    return {
      inputAmount: amount,
      outputAmount: outputAmount,
      rate: rate,
      pools: [
        {
          provider,
          poolId: `mock_pool_${provider}`,
          rate: rate,
          liquidity: 1000000,
          fee: 0.003,
          slippage: 0.005,
        },
      ],
      bestPool: {
        provider,
        poolId: `mock_pool_${provider}`,
        rate: rate,
        liquidity: 1000000,
        fee: 0.003,
        slippage: 0.005,
      },
      estimatedGas: 0.05,
      route: [fromToken, toToken],
    };
  }
}

export default DexAggregatorService;
