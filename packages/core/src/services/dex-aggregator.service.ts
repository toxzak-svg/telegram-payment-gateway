import axios from 'axios';
import { TonClient, WalletContractV4, Address, fromNano, toNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { DeDustPool } from '../contracts/dedust.contract';
import { StonfiRouter } from '../contracts/stonfi.contract';
import { DexError, DexErrorCode, parseDexError, DexRetryHandler } from './dex-error-handler';

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
  private wallet: WalletContractV4 | null = null;
  private keyPair: any = null;
  private retryHandler: DexRetryHandler;
  private simulationMode: boolean;
  
  constructor() {
    this.dedustApiUrl = process.env.DEDUST_API_URL || 'https://api.dedust.io';
    this.stonfiApiUrl = process.env.STONFI_API_URL || 'https://api.ston.fi';
    
    // Initialize TON client
    this.client = new TonClient({
      endpoint: process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY,
    });
    
    this.retryHandler = new DexRetryHandler();
    const simulationFlag = process.env.DEX_SIMULATION_MODE ?? (process.env.NODE_ENV === 'test' ? 'true' : 'false');
    this.simulationMode = simulationFlag === 'true';
  }

  /**
   * Initialize wallet for swap execution
   */
  async initializeWallet(): Promise<void> {
    if (this.wallet) {
      return; // Already initialized
    }

    if (this.isSimulationMode()) {
      this.keyPair = {
        publicKey: Buffer.alloc(32),
        secretKey: Buffer.alloc(64)
      };
      this.wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: this.keyPair.publicKey,
      });
      console.log('🧪 DEX simulator wallet initialized');
      return;
    }

    const mnemonic = process.env.TON_WALLET_MNEMONIC;
    if (!mnemonic) {
      throw new DexError(
        DexErrorCode.WALLET_NOT_INITIALIZED,
        'TON_WALLET_MNEMONIC not set in environment variables'
      );
    }

    try {
      this.keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
      this.wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: this.keyPair.publicKey,
      });

      console.log('✅ DEX wallet initialized:', this.wallet.address.toString());
    } catch (error: any) {
      throw new DexError(
        DexErrorCode.WALLET_NOT_INITIALIZED,
        `Failed to initialize wallet: ${error.message}`
      );
    }
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

      if (!this.wallet || !this.keyPair) {
        throw new DexError(
          DexErrorCode.WALLET_NOT_INITIALIZED,
          'Wallet not initialized'
        );
      }

      console.log(`🔄 Executing DeDust swap: ${amount} ${fromToken} → ${toToken}`);

      // 1. Open wallet contract
      const walletContract = this.client.open(this.wallet);
      const seqno = await walletContract.getSeqno();

      // 2. Get pool contract
      const poolAddress = Address.parse(poolId);
      const poolContract = this.client.open(DeDustPool.createFromAddress(poolAddress));

      // 3. Get pool data for validation
      const poolData = await poolContract.getPoolData();
      console.log(`📊 Pool reserves: ${fromNano(poolData.reserve0)} / ${fromNano(poolData.reserve1)}`);

      // 4. Calculate expected output
      const amountInBigInt = toNano(amount.toString());
      const minReceiveBigInt = toNano(minOutput.toString());

      const expectedOutput = DeDustPool.calculateOutputAmount(
        amountInBigInt,
        poolData.reserve0,
        poolData.reserve1,
        poolData.lpFee + poolData.protocolFee
      );

      console.log(`💰 Expected output: ${fromNano(expectedOutput)} ${toToken}`);

      // 5. Verify slippage protection
      if (expectedOutput < minReceiveBigInt) {
        throw new DexError(
          DexErrorCode.SLIPPAGE_EXCEEDED,
          `Slippage exceeded: expected ${fromNano(expectedOutput)}, minimum ${fromNano(minReceiveBigInt)}`,
          { expectedOutput: fromNano(expectedOutput), minOutput }
        );
      }

      // 6. Estimate gas
      const gasEstimate = await this.estimateGasFee('swap');
      const totalValue = amountInBigInt + gasEstimate;

      // 7. Check wallet balance
      const balance = await this.client.getBalance(this.wallet.address);
      if (balance < totalValue) {
        throw new DexError(
          DexErrorCode.INSUFFICIENT_FUNDS,
          `Insufficient balance: ${fromNano(balance)} < ${fromNano(totalValue)}`,
          { balance: fromNano(balance), required: fromNano(totalValue) }
        );
      }

      // 8. Build and send swap transaction
      const swapParams = {
        amountIn: amountInBigInt,
        minAmountOut: minReceiveBigInt,
        deadline: Math.floor(Date.now() / 1000) + 600, // 10 minutes
        recipient: this.wallet.address,
      };

      await poolContract.sendSwap(
        walletContract.sender(this.keyPair.secretKey),
        swapParams,
        totalValue
      );

      console.log('📤 Swap transaction sent, waiting for confirmation...');

      // 9. Wait for transaction confirmation (seqno increment)
      const confirmed = await this.waitForSeqnoIncrement(walletContract, seqno, 60);
      
      if (!confirmed) {
        throw new DexError(
          DexErrorCode.TRANSACTION_TIMEOUT,
          'Transaction timeout - seqno not incremented after 5 minutes'
        );
      }

      // 10. Get transaction details
      const transactions = await this.client.getTransactions(this.wallet.address, { limit: 5 });
      const txHash = transactions[0]?.hash().toString('hex') || 'unknown';

      // 11. Parse actual output amount from transaction
      const actualOutput = await this.parseSwapOutput(transactions[0]);

      console.log(`✅ DeDust swap successful!`);
      console.log(`   TX: ${txHash}`);
      console.log(`   Output: ${fromNano(actualOutput)} ${toToken}`);

      return {
        txHash,
        outputAmount: parseFloat(fromNano(actualOutput)),
        gasUsed: parseFloat(fromNano(gasEstimate)),
      };
    } catch (error: any) {
      console.error('❌ DeDust swap failed:', error);
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
      // Initialize wallet if not done
      await this.initializeWallet();

      if (!this.wallet || !this.keyPair) {
        throw new DexError(
          DexErrorCode.WALLET_NOT_INITIALIZED,
          'Wallet not initialized'
        );
      }

      console.log(`🔄 Executing Ston.fi swap: ${amount} ${fromToken} → ${toToken}`);

      // 1. Open wallet contract
      const walletContract = this.client.open(this.wallet);
      const seqno = await walletContract.getSeqno();

      // 2. Get router contract
      const routerAddress = Address.parse(
        process.env.STONFI_ROUTER_ADDRESS || 'EQB3ncyBUTjZUA5EnFKR5_EnOMI9V1tTEAAPaiU71gc4TiUt'
      );
      const routerContract = this.client.open(StonfiRouter.createFromAddress(routerAddress));

      // 3. Build swap path
      const fromTokenAddress = await this.getTokenAddress(fromToken);
      const toTokenAddress = await this.getTokenAddress(toToken);
      const path = [fromTokenAddress, toTokenAddress];

      // 4. Get expected output amounts
      const amountInBigInt = toNano(amount.toString());
      const amountsOut = await routerContract.getAmountsOut(amountInBigInt, path);
      const expectedOutput = amountsOut[amountsOut.length - 1];

      console.log(`💰 Expected output: ${fromNano(expectedOutput)} ${toToken}`);

      // 5. Verify slippage
      const minReceiveBigInt = toNano(minOutput.toString());
      if (expectedOutput < minReceiveBigInt) {
        throw new DexError(
          DexErrorCode.SLIPPAGE_EXCEEDED,
          `Slippage exceeded: expected ${fromNano(expectedOutput)}, minimum ${fromNano(minReceiveBigInt)}`,
          { expectedOutput: fromNano(expectedOutput), minOutput }
        );
      }

      // 6. Estimate gas and check balance
      const gasEstimate = await this.estimateGasFee('swap');
      const totalValue = amountInBigInt + gasEstimate;

      const balance = await this.client.getBalance(this.wallet.address);
      if (balance < totalValue) {
        throw new DexError(
          DexErrorCode.INSUFFICIENT_FUNDS,
          `Insufficient balance: ${fromNano(balance)} < ${fromNano(totalValue)}`,
          { balance: fromNano(balance), required: fromNano(totalValue) }
        );
      }

      // 7. Execute swap
      const swapParams = {
        amountIn: amountInBigInt,
        amountOutMin: minReceiveBigInt,
        path,
        to: this.wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      };

      await routerContract.sendSwapExactTokensForTokens(
        walletContract.sender(this.keyPair.secretKey),
        swapParams,
        totalValue
      );

      console.log('📤 Swap transaction sent, waiting for confirmation...');

      // 8. Wait for confirmation
      const confirmed = await this.waitForSeqnoIncrement(walletContract, seqno, 60);
      
      if (!confirmed) {
        throw new DexError(
          DexErrorCode.TRANSACTION_TIMEOUT,
          'Transaction timeout - seqno not incremented'
        );
      }

      // 9. Get transaction details
      const transactions = await this.client.getTransactions(this.wallet.address, { limit: 5 });
      const txHash = transactions[0]?.hash().toString('hex') || 'unknown';
      const actualOutput = await this.parseStonfiSwapOutput(transactions[0]);

      console.log(`✅ Ston.fi swap successful!`);
      console.log(`   TX: ${txHash}`);
      console.log(`   Output: ${fromNano(actualOutput)} ${toToken}`);

      return {
        txHash,
        outputAmount: parseFloat(fromNano(actualOutput)),
        gasUsed: parseFloat(fromNano(gasEstimate)),
      };
    } catch (error: any) {
      console.error('❌ Ston.fi swap failed:', error);
      throw parseDexError(error);
    }
  }

  /**
   * Wait for seqno to increment (transaction confirmed)
   */
  private async waitForSeqnoIncrement(
    wallet: any,
    initialSeqno: number,
    maxAttempts: number = 60
  ): Promise<boolean> {
    let currentSeqno = initialSeqno;
    let attempts = 0;

    while (currentSeqno === initialSeqno && attempts < maxAttempts) {
      await this.delay(5000); // Check every 5 seconds
      currentSeqno = await wallet.getSeqno();
      attempts++;
      
      if (attempts % 6 === 0) {
        console.log(`⏳ Waiting for confirmation... (${attempts * 5}s)`);
      }
    }

    return currentSeqno > initialSeqno;
  }

  /**
   * Estimate gas fee for operation
   */
  private async estimateGasFee(operation: 'swap' | 'deposit'): Promise<bigint> {
    const baseGas = {
      swap: 0.05, // 0.05 TON for swap
      deposit: 0.1, // 0.1 TON for deposit
    };

    const gasAmount = baseGas[operation] || 0.1;
    const multiplier = parseFloat(process.env.GAS_MULTIPLIER || '1.2'); // 20% buffer
    
    return toNano((gasAmount * multiplier).toString());
  }

  /**
   * Parse swap output from DeDust transaction
   */
  private async parseSwapOutput(transaction: any): Promise<bigint> {
    if (!transaction || !transaction.outMessages) {
      // Fallback: estimate from input
      console.warn('Could not parse transaction, using estimate');
      return BigInt(0);
    }

    try {
      // Look for outgoing message with tokens
      for (const msg of transaction.outMessages.values()) {
        const body = msg.body;
        if (body && body.beginParse) {
          const slice = body.beginParse();
          const op = slice.loadUint(32);
          
          // DeDust transfer notification op code
          if (op === 0x7362d09c || op === 0xf8a7ea5) {
            return slice.loadCoins();
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing transaction output:', error);
    }

    return BigInt(0);
  }

  /**
   * Parse swap output from Ston.fi transaction
   */
  private async parseStonfiSwapOutput(transaction: any): Promise<bigint> {
    // Similar to DeDust but with Ston.fi specific format
    return this.parseSwapOutput(transaction);
  }

  /**
   * Get token address from symbol
   */
  private async getTokenAddress(symbol: string): Promise<Address> {
    // Token address mapping (mainnet/testnet)
    const isMainnet = process.env.TON_MAINNET === 'true';
    
    const tokenMap: Record<string, string> = {
      TON: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', // Native TON
      USDT: process.env.STONFI_USDT_ADDRESS || (isMainnet 
        ? 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'
        : 'EQ_testnet_usdt'),
      USDC: process.env.STONFI_USDC_ADDRESS || 'EQ_usdc_address',
    };

    const address = tokenMap[symbol];
    if (!address) {
      throw new DexError(
        DexErrorCode.INVALID_TOKEN_ADDRESS,
        `Token ${symbol} not supported`
      );
    }

    return Address.parse(address);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isSimulationMode(): boolean {
    return this.simulationMode;
  }

  private buildMockQuote(
    provider: 'dedust' | 'stonfi',
    fromToken: string,
    toToken: string,
    amount: number
  ): DexQuote {
    const baseRate = provider === 'dedust' ? 2.12 : 2.08;
    const liquidity = provider === 'dedust' ? 125000 : 98000;
    const outputAmount = parseFloat((amount * baseRate).toFixed(6));
    const estimatedGas = provider === 'dedust' ? 0.018 : 0.021;

    const pool: DexPoolInfo = {
      provider,
      poolId: provider === 'dedust' ? 'EQB_MOCK_DEDUST_POOL' : 'EQB_MOCK_STONFI_POOL',
      rate: baseRate,
      liquidity,
      fee: 0.003,
      slippage: 0.005,
    };

    return {
      inputAmount: amount,
      outputAmount,
      rate: baseRate,
      pools: [pool],
      bestPool: pool,
      estimatedGas,
      route: [fromToken, toToken],
    };
  }

  private simulateSwap(
    provider: 'dedust' | 'stonfi',
    poolId: string,
    fromToken: string,
    toToken: string,
    amount: number,
    minOutput: number
  ): SwapResult {
    if (!poolId || !poolId.startsWith('EQ')) {
      throw new DexError(
        DexErrorCode.POOL_NOT_FOUND,
        `Pool ${poolId} not recognized in simulator`
      );
    }

    const mockRate = provider === 'dedust' ? 2.1 : 2.04;
    const outputAmount = parseFloat((amount * mockRate).toFixed(6));

    if (outputAmount < minOutput) {
      throw new DexError(
        DexErrorCode.SLIPPAGE_EXCEEDED,
        `Simulated output ${outputAmount} below minimum ${minOutput}`,
        { provider, mockRate }
      );
    }

    const gasUsed = provider === 'dedust' ? 0.015 : 0.018;

    return {
      txHash: `simulated-${provider}-${Date.now()}`,
      outputAmount,
      gasUsed,
    };
  }
}

export default DexAggregatorService;
