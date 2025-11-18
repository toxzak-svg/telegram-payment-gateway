# Smart Contract Integration Plan

**Priority**: CRITICAL | **Blocker**: YES  
**Estimated Time**: 10-12 days  
**Owner**: Core Team  
**Status**: 🔴 Not Started

---

## 📋 Overview

Implement actual DEX swap execution on TON blockchain through DeDust V2 and Ston.fi smart contracts. This is the #1 blocker for production launch.

**Current State**: Mock implementations return fake transaction hashes  
**Target State**: Real on-chain swaps executed through DEX smart contracts  
**Impact**: Enables actual TON ↔ Token conversions (core product functionality)

---

## 🎯 Goals

1. ✅ Execute real swaps on DeDust V2 pools
2. ✅ Execute real swaps on Ston.fi router
3. ✅ Handle slippage protection correctly
4. ✅ Estimate gas fees accurately
5. ✅ Parse transaction results from blockchain
6. ✅ Handle error cases and reverted transactions
7. ✅ Test thoroughly on testnet before mainnet

---

## 📚 Prerequisites & Research

### Phase 0: Documentation & Setup (Day 1)

#### DeDust V2 Research
- [ ] Read official docs: https://docs.dedust.io/docs/introduction
- [ ] Study smart contract ABI: https://github.com/dedust-io/contracts
- [ ] Understand pool structure and swap parameters
- [ ] Review example transactions on TON explorer
- [ ] Join DeDust Telegram group for support

**Key Concepts to Understand**:
- Pool types (constant product, stable swap)
- Asset format (native TON vs jettons)
- Swap routing (direct vs multi-hop)
- Slippage tolerance configuration
- Gas fee calculation

#### Ston.fi Research
- [ ] Read docs: https://docs.ston.fi/
- [ ] Study router contract: https://github.com/ston-fi/router-contracts
- [ ] Understand swap path encoding
- [ ] Review liquidity pool mechanics
- [ ] Check API rate limits and restrictions

**Key Concepts**:
- Router vs direct pool interaction
- Path encoding for multi-hop swaps
- Deadline parameter for time-sensitive swaps
- Fee structure (0.25% standard)
- Liquidity provider tokens

#### TON SDK Deep Dive
- [ ] Study TonWeb documentation: https://github.com/toncenter/tonweb
- [ ] Understand wallet interaction patterns
- [ ] Learn transaction building and signing
- [ ] Master gas estimation techniques
- [ ] Explore transaction parsing methods

**Critical Skills**:
- Building and signing transactions
- Encoding smart contract calls
- Parsing transaction results
- Error handling and retry logic
- Gas optimization

#### Environment Setup
```bash
# Install additional dependencies
npm install @ton/ton @ton/core @ton/crypto tonweb

# Setup testnet wallet
node scripts/generate-ton-wallet.js --testnet

# Fund testnet wallet
# Visit: https://t.me/testgiver_ton_bot
# Request testnet TON

# Verify wallet balance
node scripts/check-wallet-balance.js
```

---

## 🏗️ Implementation Plan

### Phase 1: DeDust V2 Integration (Days 2-5)

#### Step 1.1: Contract Interface Setup (Day 2)

**File**: `packages/core/src/contracts/dedust.contract.ts`

```typescript
import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';
import { TonClient } from '@ton/ton';

export interface DeDustPoolConfig {
  poolAddress: Address;
  token0: Address;
  token1: Address;
  fee: number;
}

export interface SwapParams {
  amountIn: bigint;
  minAmountOut: bigint;
  deadline: number;
  recipient: Address;
}

export class DeDustPool implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new DeDustPool(address);
  }

  async getPoolData(provider: ContractProvider) {
    const result = await provider.get('get_pool_data', []);
    return {
      reserve0: result.stack.readBigNumber(),
      reserve1: result.stack.readBigNumber(),
      token0: result.stack.readAddress(),
      token1: result.stack.readAddress(),
      lpFee: result.stack.readNumber(),
      protocolFee: result.stack.readNumber(),
    };
  }

  async sendSwap(
    provider: ContractProvider,
    via: Sender,
    params: SwapParams,
    value: bigint
  ) {
    const messageBody = beginCell()
      .storeUint(0x25938561, 32) // swap op code
      .storeUint(0, 64) // query id
      .storeCoins(params.amountIn)
      .storeCoins(params.minAmountOut)
      .storeUint(params.deadline, 32)
      .storeAddress(params.recipient)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }
}

export class DeDustVault implements Contract {
  constructor(readonly address: Address) {}

  static createFromAddress(address: Address) {
    return new DeDustVault(address);
  }

  async sendDeposit(
    provider: ContractProvider,
    via: Sender,
    params: {
      poolAddress: Address;
      amount: bigint;
      minLpOut: bigint;
    },
    value: bigint
  ) {
    const messageBody = beginCell()
      .storeUint(0x21eeb607, 32) // deposit op code
      .storeAddress(params.poolAddress)
      .storeCoins(params.amount)
      .storeCoins(params.minLpOut)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }
}
```

#### Step 1.2: DeDust Service Implementation (Day 3)

**File**: `packages/core/src/services/dex-aggregator.service.ts`

Update the mock `executeDeDustSwap` method:

```typescript
import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { DeDustPool } from '../contracts/dedust.contract';

async executeDeDustSwap(
  provider: 'dedust',
  poolId: string,
  fromToken: string,
  toToken: string,
  amount: number,
  minReceive: number
): Promise<{ txHash: string; outputAmount: number }> {
  try {
    // 1. Initialize TON client
    const client = new TonClient({
      endpoint: process.env.TON_API_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY,
    });

    // 2. Get wallet from mnemonic
    const mnemonic = process.env.TON_WALLET_MNEMONIC!.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    const walletContract = client.open(wallet);
    const seqno = await walletContract.getSeqno();

    // 3. Get pool contract
    const poolAddress = Address.parse(poolId);
    const poolContract = client.open(DeDustPool.createFromAddress(poolAddress));

    // 4. Get pool data for validation
    const poolData = await poolContract.getPoolData();
    console.log('Pool reserves:', poolData);

    // 5. Calculate expected output (constant product formula: x * y = k)
    const amountInBigInt = BigInt(Math.floor(amount * 1e9)); // Convert to nanotons
    const minReceiveBigInt = BigInt(Math.floor(minReceive * 1e9));

    const reserve0 = poolData.reserve0;
    const reserve1 = poolData.reserve1;
    const fee = poolData.lpFee + poolData.protocolFee; // e.g., 0.003 = 0.3%

    // Calculate output: (amountIn * (1 - fee) * reserve1) / (reserve0 + amountIn * (1 - fee))
    const amountInWithFee = (amountInBigInt * BigInt(10000 - fee * 10000)) / BigInt(10000);
    const numerator = amountInWithFee * reserve1;
    const denominator = reserve0 + amountInWithFee;
    const expectedOutput = numerator / denominator;

    // 6. Verify slippage protection
    if (expectedOutput < minReceiveBigInt) {
      throw new Error(
        `Slippage exceeded: expected ${expectedOutput}, minimum ${minReceiveBigInt}`
      );
    }

    // 7. Estimate gas fees
    const gasEstimate = await this.estimateGasFee(client, poolAddress, 'swap');
    const totalValue = amountInBigInt + gasEstimate;

    // 8. Send swap transaction
    const swapParams = {
      amountIn: amountInBigInt,
      minAmountOut: minReceiveBigInt,
      deadline: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      recipient: wallet.address,
    };

    await poolContract.sendSwap(
      walletContract.sender(keyPair.secretKey),
      swapParams,
      totalValue
    );

    // 9. Wait for transaction confirmation
    let currentSeqno = seqno;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (5s intervals)

    while (currentSeqno === seqno && attempts < maxAttempts) {
      await this.delay(5000);
      currentSeqno = await walletContract.getSeqno();
      attempts++;
    }

    if (currentSeqno === seqno) {
      throw new Error('Transaction timeout - seqno not incremented');
    }

    // 10. Get transaction hash (simplified - in production, parse from transactions)
    const transactions = await client.getTransactions(wallet.address, { limit: 1 });
    const txHash = transactions[0]?.hash().toString('hex') || 'unknown';

    // 11. Parse actual output amount from transaction
    const actualOutput = await this.parseSwapOutput(transactions[0]);

    console.log(`DeDust swap successful: ${txHash}`);
    console.log(`Input: ${amount} ${fromToken}, Output: ${actualOutput} ${toToken}`);

    return {
      txHash,
      outputAmount: Number(actualOutput) / 1e9, // Convert from nanotons
    };
  } catch (error: any) {
    console.error('DeDust swap failed:', error);
    
    // Handle specific error cases
    if (error.message.includes('insufficient funds')) {
      throw new Error('INSUFFICIENT_FUNDS: Wallet balance too low');
    }
    if (error.message.includes('slippage')) {
      throw new Error('SLIPPAGE_EXCEEDED: Price moved beyond tolerance');
    }
    if (error.message.includes('pool not found')) {
      throw new Error('POOL_NOT_FOUND: Invalid pool address');
    }
    
    throw new Error(`DEX_SWAP_FAILED: ${error.message}`);
  }
}

private async estimateGasFee(
  client: TonClient,
  poolAddress: Address,
  operation: string
): Promise<bigint> {
  // Gas estimation based on operation type
  const gasAmounts = {
    swap: BigInt(0.05 * 1e9), // 0.05 TON for swap
    deposit: BigInt(0.1 * 1e9), // 0.1 TON for liquidity deposit
    withdraw: BigInt(0.05 * 1e9),
  };

  return gasAmounts[operation] || BigInt(0.1 * 1e9);
}

private async parseSwapOutput(transaction: any): Promise<bigint> {
  // Parse transaction to extract actual output amount
  // This is simplified - production code needs robust parsing
  
  if (!transaction || !transaction.outMessages) {
    throw new Error('Invalid transaction structure');
  }

  // Look for outgoing message with tokens
  for (const msg of transaction.outMessages) {
    const body = msg.body;
    if (body && body.beginParse) {
      const slice = body.beginParse();
      const op = slice.loadUint(32);
      
      // DeDust transfer notification op code
      if (op === 0x7362d09c) {
        return slice.loadCoins(); // Amount transferred
      }
    }
  }

  throw new Error('Could not parse swap output from transaction');
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### Step 1.3: Error Handling & Retry Logic (Day 4)

**File**: `packages/core/src/services/dex-error-handler.ts`

```typescript
export enum DexErrorCode {
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class DexError extends Error {
  constructor(
    public code: DexErrorCode,
    message: string,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'DexError';
  }
}

export class DexRetryHandler {
  private maxRetries = 3;
  private retryDelays = [1000, 3000, 5000]; // Exponential backoff

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryableErrors: DexErrorCode[]
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (error instanceof DexError && retryableErrors.includes(error.code)) {
          console.log(`Retry attempt ${attempt + 1}/${this.maxRetries} for ${error.code}`);
          
          if (attempt < this.maxRetries - 1) {
            await this.delay(this.retryDelays[attempt]);
            continue;
          }
        }

        // Non-retryable error or max retries exceeded
        throw error;
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function parseDexError(error: any): DexError {
  const message = error.message || error.toString();

  if (message.includes('insufficient liquidity')) {
    return new DexError(
      DexErrorCode.INSUFFICIENT_LIQUIDITY,
      'Pool has insufficient liquidity for this swap',
      { originalError: message }
    );
  }

  if (message.includes('slippage') || message.includes('min amount')) {
    return new DexError(
      DexErrorCode.SLIPPAGE_EXCEEDED,
      'Price moved beyond slippage tolerance',
      { originalError: message }
    );
  }

  if (message.includes('insufficient funds') || message.includes('balance')) {
    return new DexError(
      DexErrorCode.INSUFFICIENT_FUNDS,
      'Wallet has insufficient balance',
      { originalError: message }
    );
  }

  if (message.includes('reverted') || message.includes('failed')) {
    return new DexError(
      DexErrorCode.TRANSACTION_REVERTED,
      'Transaction reverted on blockchain',
      { originalError: message }
    );
  }

  if (message.includes('deadline')) {
    return new DexError(
      DexErrorCode.DEADLINE_EXCEEDED,
      'Transaction deadline exceeded',
      { originalError: message }
    );
  }

  // Default to network error
  return new DexError(
    DexErrorCode.NETWORK_ERROR,
    'Unknown DEX error occurred',
    { originalError: message }
  );
}
```

#### Step 1.4: Testing on Testnet (Day 5)

**File**: `packages/core/src/__tests__/integration/dedust-swap.test.ts`

```typescript
import { DexAggregatorService } from '../../services/dex-aggregator.service';
import { Address } from '@ton/core';

describe('DeDust Swap Integration', () => {
  let dexService: DexAggregatorService;

  beforeAll(() => {
    // Ensure testnet environment
    expect(process.env.TON_MAINNET).toBe('false');
    expect(process.env.TON_WALLET_MNEMONIC).toBeDefined();

    dexService = new DexAggregatorService();
  });

  describe('Small Swaps (< 1 TON)', () => {
    it('should swap 0.1 TON to USDT', async () => {
      const result = await dexService.executeDeDustSwap(
        'dedust',
        'EQD_test_pool_address', // Testnet pool
        'TON',
        'USDT',
        0.1,
        0.09 // 10% slippage for testing
      );

      expect(result.txHash).toBeDefined();
      expect(result.outputAmount).toBeGreaterThan(0);
      expect(result.outputAmount).toBeGreaterThanOrEqual(0.09);
    }, 60000); // 60s timeout

    it('should handle slippage protection', async () => {
      await expect(
        dexService.executeDeDustSwap(
          'dedust',
          'EQD_test_pool_address',
          'TON',
          'USDT',
          0.1,
          999 // Unrealistic minimum
        )
      ).rejects.toThrow('SLIPPAGE_EXCEEDED');
    });
  });

  describe('Medium Swaps (1-10 TON)', () => {
    it('should swap 5 TON to USDT', async () => {
      const result = await dexService.executeDeDustSwap(
        'dedust',
        'EQD_test_pool_address',
        'TON',
        'USDT',
        5.0,
        4.5 // 10% slippage
      );

      expect(result.txHash).toBeDefined();
      expect(result.outputAmount).toBeGreaterThanOrEqual(4.5);
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle insufficient liquidity', async () => {
      await expect(
        dexService.executeDeDustSwap(
          'dedust',
          'EQD_test_pool_address',
          'TON',
          'USDT',
          10000, // Huge amount
          9000
        )
      ).rejects.toThrow('INSUFFICIENT_LIQUIDITY');
    });

    it('should handle invalid pool address', async () => {
      await expect(
        dexService.executeDeDustSwap(
          'dedust',
          'EQD_invalid_address',
          'TON',
          'USDT',
          0.1,
          0.09
        )
      ).rejects.toThrow('POOL_NOT_FOUND');
    });
  });
});
```

**Test Execution**:
```bash
# Run testnet integration tests
npm run test:integration -- dedust-swap.test.ts

# Manual testing script
node packages/core/scripts/test-dedust-swap.js \
  --pool EQD_test_pool_address \
  --amount 0.1 \
  --from TON \
  --to USDT
```

---

### Phase 2: Ston.fi Integration (Days 6-8)

#### Step 2.1: Ston.fi Contract Interface (Day 6)

**File**: `packages/core/src/contracts/stonfi.contract.ts`

```typescript
import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';

export interface StonfiSwapParams {
  amountIn: bigint;
  amountOutMin: bigint;
  path: Address[]; // Token addresses for swap path
  to: Address;
  deadline: number;
}

export class StonfiRouter implements Contract {
  constructor(readonly address: Address) {}

  static createFromAddress(address: Address) {
    return new StonfiRouter(address);
  }

  async getAmountsOut(
    provider: ContractProvider,
    amountIn: bigint,
    path: Address[]
  ): Promise<bigint[]> {
    const pathCell = beginCell();
    path.forEach(addr => pathCell.storeAddress(addr));

    const result = await provider.get('get_amounts_out', [
      { type: 'int', value: amountIn },
      { type: 'cell', cell: pathCell.endCell() },
    ]);

    const amounts: bigint[] = [];
    const tuple = result.stack.readTuple();
    while (tuple.remaining > 0) {
      amounts.push(tuple.readBigNumber());
    }

    return amounts;
  }

  async sendSwapExactTokensForTokens(
    provider: ContractProvider,
    via: Sender,
    params: StonfiSwapParams,
    value: bigint
  ) {
    // Encode path as cell
    const pathCell = beginCell();
    params.path.forEach(addr => pathCell.storeAddress(addr));

    const messageBody = beginCell()
      .storeUint(0x25938561, 32) // swapExactTokensForTokens op code
      .storeUint(0, 64) // query id
      .storeCoins(params.amountIn)
      .storeCoins(params.amountOutMin)
      .storeRef(pathCell.endCell())
      .storeAddress(params.to)
      .storeUint(params.deadline, 32)
      .endCell();

    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }
}
```

#### Step 2.2: Ston.fi Service Implementation (Day 7)

**Update**: `packages/core/src/services/dex-aggregator.service.ts`

```typescript
async executeStonfiSwap(
  provider: 'stonfi',
  poolId: string, // Not used directly - uses router
  fromToken: string,
  toToken: string,
  amount: number,
  minReceive: number
): Promise<{ txHash: string; outputAmount: number }> {
  try {
    // 1. Initialize client and wallet (same as DeDust)
    const client = new TonClient({
      endpoint: process.env.TON_API_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY,
    });

    const mnemonic = process.env.TON_WALLET_MNEMONIC!.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    const walletContract = client.open(wallet);
    const seqno = await walletContract.getSeqno();

    // 2. Get router contract
    const routerAddress = Address.parse(process.env.STONFI_ROUTER_ADDRESS!);
    const routerContract = client.open(StonfiRouter.createFromAddress(routerAddress));

    // 3. Build swap path (direct swap for now)
    const fromTokenAddress = await this.getTokenAddress(fromToken);
    const toTokenAddress = await this.getTokenAddress(toToken);
    const path = [fromTokenAddress, toTokenAddress];

    // 4. Get expected output amounts
    const amountInBigInt = BigInt(Math.floor(amount * 1e9));
    const amountsOut = await routerContract.getAmountsOut(amountInBigInt, path);
    const expectedOutput = amountsOut[amountsOut.length - 1];

    console.log(`Expected output: ${Number(expectedOutput) / 1e9} ${toToken}`);

    // 5. Verify slippage
    const minReceiveBigInt = BigInt(Math.floor(minReceive * 1e9));
    if (expectedOutput < minReceiveBigInt) {
      throw new Error(
        `Slippage exceeded: expected ${expectedOutput}, minimum ${minReceiveBigInt}`
      );
    }

    // 6. Estimate gas
    const gasEstimate = BigInt(0.1 * 1e9); // 0.1 TON for router swap
    const totalValue = amountInBigInt + gasEstimate;

    // 7. Execute swap
    const swapParams = {
      amountIn: amountInBigInt,
      amountOutMin: minReceiveBigInt,
      path,
      to: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 600, // 10 minutes
    };

    await routerContract.sendSwapExactTokensForTokens(
      walletContract.sender(keyPair.secretKey),
      swapParams,
      totalValue
    );

    // 8. Wait for confirmation
    let currentSeqno = seqno;
    let attempts = 0;
    const maxAttempts = 60;

    while (currentSeqno === seqno && attempts < maxAttempts) {
      await this.delay(5000);
      currentSeqno = await walletContract.getSeqno();
      attempts++;
    }

    if (currentSeqno === seqno) {
      throw new Error('Transaction timeout');
    }

    // 9. Get transaction details
    const transactions = await client.getTransactions(wallet.address, { limit: 1 });
    const txHash = transactions[0]?.hash().toString('hex') || 'unknown';
    const actualOutput = await this.parseStonfiSwapOutput(transactions[0]);

    console.log(`Ston.fi swap successful: ${txHash}`);
    console.log(`Input: ${amount} ${fromToken}, Output: ${actualOutput} ${toToken}`);

    return {
      txHash,
      outputAmount: Number(actualOutput) / 1e9,
    };
  } catch (error: any) {
    console.error('Ston.fi swap failed:', error);
    throw parseDexError(error);
  }
}

private async getTokenAddress(symbol: string): Promise<Address> {
  // Token address mapping (testnet addresses)
  const tokenMap: Record<string, string> = {
    TON: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', // Native TON
    USDT: process.env.STONFI_USDT_ADDRESS || 'EQ_testnet_usdt',
    USDC: process.env.STONFI_USDC_ADDRESS || 'EQ_testnet_usdc',
    // Add more tokens as needed
  };

  const address = tokenMap[symbol];
  if (!address) {
    throw new Error(`Token ${symbol} not supported`);
  }

  return Address.parse(address);
}

private async parseStonfiSwapOutput(transaction: any): Promise<bigint> {
  // Similar to DeDust parsing but for Ston.fi format
  if (!transaction || !transaction.outMessages) {
    throw new Error('Invalid transaction structure');
  }

  for (const msg of transaction.outMessages) {
    const body = msg.body;
    if (body && body.beginParse) {
      const slice = body.beginParse();
      const op = slice.loadUint(32);
      
      // Ston.fi transfer notification op code
      if (op === 0xf8a7ea5) {
        slice.loadUint(64); // query_id
        return slice.loadCoins(); // Amount
      }
    }
  }

  throw new Error('Could not parse Ston.fi swap output');
}
```

#### Step 2.3: Ston.fi Testing (Day 8)

Similar test structure as DeDust, test file: `packages/core/src/__tests__/integration/stonfi-swap.test.ts`

---

### Phase 3: Integration & Optimization (Days 9-10)

#### Step 3.1: Update ConversionService (Day 9)

**File**: `packages/core/src/services/conversion.service.ts`

```typescript
async executeConversion(conversionId: string) {
  const conversion = await this.conversionModel.findById(conversionId);
  
  if (!conversion) {
    throw new Error('Conversion not found');
  }

  try {
    // 1. Update status to converting
    await this.conversionModel.update(conversionId, { status: 'converting' });

    // 2. Get best DEX route
    const route = await this.dexAggregator.findBestRoute(
      'TON',
      conversion.target_currency,
      conversion.ton_amount
    );

    // 3. Execute swap based on provider
    let swapResult;
    if (route.provider === 'dedust') {
      swapResult = await this.dexAggregator.executeDeDustSwap(
        'dedust',
        route.poolId,
        'TON',
        conversion.target_currency,
        conversion.ton_amount,
        conversion.expected_amount * 0.99 // 1% slippage tolerance
      );
    } else if (route.provider === 'stonfi') {
      swapResult = await this.dexAggregator.executeStonfiSwap(
        'stonfi',
        route.poolId,
        'TON',
        conversion.target_currency,
        conversion.ton_amount,
        conversion.expected_amount * 0.99
      );
    } else {
      throw new Error(`Unsupported provider: ${route.provider}`);
    }

    // 4. Update conversion with results
    await this.conversionModel.update(conversionId, {
      status: 'completed',
      actual_amount: swapResult.outputAmount,
      dex_tx_hash: swapResult.txHash,
      dex_provider: route.provider,
      dex_pool_id: route.poolId,
      completed_at: new Date(),
    });

    // 5. Trigger webhook
    await this.webhookService.trigger('conversion.completed', {
      conversionId,
      txHash: swapResult.txHash,
      outputAmount: swapResult.outputAmount,
    });

    // 6. Create settlement
    await this.settlementService.createSettlement(conversion);

    return swapResult;
  } catch (error: any) {
    console.error('Conversion failed:', error);

    // Update status to failed
    await this.conversionModel.update(conversionId, {
      status: 'failed',
      error_message: error.message,
      failed_at: new Date(),
    });

    // Trigger webhook
    await this.webhookService.trigger('conversion.failed', {
      conversionId,
      error: error.message,
    });

    throw error;
  }
}
```

#### Step 3.2: Gas Optimization (Day 10)

**File**: `packages/core/src/services/gas-optimizer.service.ts`

```typescript
export class GasOptimizerService {
  async calculateOptimalGas(
    operation: 'swap' | 'deposit' | 'withdraw',
    complexity: 'simple' | 'complex'
  ): Promise<bigint> {
    // Base gas amounts (in nanoTON)
    const baseGas = {
      swap: {
        simple: 0.05, // Direct pool swap
        complex: 0.15, // Multi-hop swap
      },
      deposit: {
        simple: 0.1,
        complex: 0.2,
      },
      withdraw: {
        simple: 0.05,
        complex: 0.1,
      },
    };

    // Get current network load factor (1.0 = normal, 2.0 = congested)
    const loadFactor = await this.getNetworkLoadFactor();

    const baseAmount = baseGas[operation][complexity];
    const adjustedAmount = baseAmount * loadFactor;

    return BigInt(Math.ceil(adjustedAmount * 1e9));
  }

  private async getNetworkLoadFactor(): Promise<number> {
    try {
      // Query TON blockchain for recent block times
      // If blocks are slow, increase gas
      const client = new TonClient({
        endpoint: process.env.TON_API_URL!,
        apiKey: process.env.TON_API_KEY,
      });

      const masterchainInfo = await client.getMasterchainInfo();
      const blockTime = masterchainInfo.last.utime;
      const now = Math.floor(Date.now() / 1000);
      const blockAge = now - blockTime;

      // If last block is >10s old, network might be congested
      if (blockAge > 10) {
        return 1.5; // 50% more gas
      }

      return 1.0; // Normal
    } catch (error) {
      console.error('Failed to get network load:', error);
      return 1.2; // Default to slightly higher gas
    }
  }

  async estimateTotalCost(
    operation: 'swap' | 'deposit',
    amount: bigint
  ): Promise<{ amount: bigint; gas: bigint; total: bigint }> {
    const gas = await this.calculateOptimalGas(operation, 'simple');
    const total = amount + gas;

    return { amount, gas, total };
  }
}
```

---

### Phase 4: Production Deployment (Days 11-12)

#### Step 4.1: Mainnet Configuration (Day 11)

**Environment Variables**:
```bash
# .env.production

# Mainnet Configuration
TON_MAINNET=true
TON_API_URL=https://toncenter.com/api/v2/jsonRPC
TON_API_KEY=your_mainnet_api_key

# DeDust Mainnet Addresses
DEDUST_VAULT_ADDRESS=EQDa4VOnTYlLvDJ0gZjNYm5PXfSmmtL6Vs6A_CZEtXCNICq_
DEDUST_TON_USDT_POOL=EQD_ton_usdt_pool_mainnet

# Ston.fi Mainnet Addresses
STONFI_ROUTER_ADDRESS=EQB3ncyBUTjZUA5EnFKR5_EnOMI9V1tTEAAPaiU71gc4TiUt
STONFI_USDT_ADDRESS=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs

# Gas Settings
GAS_MULTIPLIER=1.2  # 20% buffer for safety
MAX_GAS_PER_TX=0.5  # TON (prevent expensive mistakes)
```

#### Step 4.2: Safety Checks & Monitoring (Day 12)

**File**: `packages/core/src/services/safety-checks.service.ts`

```typescript
export class SafetyChecksService {
  async preSwapValidation(params: {
    amount: number;
    provider: string;
    poolId: string;
  }): Promise<{ safe: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    // 1. Check amount is within safe limits
    const maxSingleSwap = parseFloat(process.env.MAX_SINGLE_SWAP || '100');
    if (params.amount > maxSingleSwap) {
      warnings.push(`Amount ${params.amount} exceeds max ${maxSingleSwap} TON`);
      return { safe: false, warnings };
    }

    // 2. Verify pool exists and has liquidity
    const poolLiquidity = await this.checkPoolLiquidity(params.poolId);
    if (poolLiquidity < params.amount * 2) {
      warnings.push(`Low liquidity: pool has ${poolLiquidity} TON`);
    }

    // 3. Check wallet balance
    const balance = await this.getWalletBalance();
    const estimatedCost = params.amount * 1.1; // +10% for gas
    if (balance < estimatedCost) {
      warnings.push(`Insufficient balance: ${balance} < ${estimatedCost}`);
      return { safe: false, warnings };
    }

    // 4. Rate sanity check
    const expectedRate = await this.getExpectedRate(params.provider);
    const actualRate = await this.dexService.getRate(params.provider, params.poolId);
    const deviation = Math.abs(actualRate - expectedRate) / expectedRate;
    if (deviation > 0.05) {
      warnings.push(`Rate deviation: ${(deviation * 100).toFixed(2)}%`);
    }

    return { safe: true, warnings };
  }

  async postSwapVerification(
    expectedOutput: number,
    actualOutput: number
  ): Promise<boolean> {
    const deviation = Math.abs(actualOutput - expectedOutput) / expectedOutput;
    
    // Allow up to 2% deviation (1% slippage + 1% margin)
    if (deviation > 0.02) {
      console.error(`Output mismatch: expected ${expectedOutput}, got ${actualOutput}`);
      return false;
    }

    return true;
  }
}
```

**Monitoring Setup**:
```typescript
// packages/core/src/services/swap-monitoring.service.ts

export class SwapMonitoringService {
  async logSwap(data: {
    conversionId: string;
    provider: string;
    amountIn: number;
    amountOut: number;
    txHash: string;
    gasUsed: number;
  }) {
    // Log to database
    await db.query(`
      INSERT INTO swap_logs (conversion_id, provider, amount_in, amount_out, tx_hash, gas_used, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      data.conversionId,
      data.provider,
      data.amountIn,
      data.amountOut,
      data.txHash,
      data.gasUsed,
    ]);

    // Send to monitoring service (Prometheus, Datadog, etc.)
    this.metrics.increment('swaps.total', { provider: data.provider });
    this.metrics.histogram('swaps.amount_in', data.amountIn);
    this.metrics.histogram('swaps.amount_out', data.amountOut);
    this.metrics.histogram('swaps.gas_used', data.gasUsed);
  }

  async getSwapMetrics(timeframe: '1h' | '24h' | '7d'): Promise<{
    totalSwaps: number;
    totalVolume: number;
    avgGasUsed: number;
    successRate: number;
  }> {
    // Query metrics from database
    const result = await db.oneOrNone(`
      SELECT 
        COUNT(*) as total_swaps,
        SUM(amount_in) as total_volume,
        AVG(gas_used) as avg_gas_used,
        (COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*)) as success_rate
      FROM swap_logs
      WHERE created_at > NOW() - INTERVAL '${timeframe}'
    `);

    return result || { totalSwaps: 0, totalVolume: 0, avgGasUsed: 0, successRate: 0 };
  }
}
```

---

## ✅ Success Criteria

### DeDust Integration
- [ ] Can execute swaps on testnet
- [ ] Can execute swaps on mainnet
- [ ] Transaction hash returned correctly
- [ ] Output amount parsed accurately
- [ ] Slippage protection works
- [ ] Gas estimation accurate (±10%)
- [ ] Error handling robust
- [ ] Test coverage >80%

### Ston.fi Integration
- [ ] Router contract interaction working
- [ ] Multi-hop swaps supported
- [ ] Path encoding correct
- [ ] Output parsing accurate
- [ ] Gas estimation appropriate
- [ ] Test coverage >80%

### Overall System
- [ ] ConversionService updated
- [ ] Safety checks in place
- [ ] Monitoring implemented
- [ ] Production environment configured
- [ ] Documentation updated
- [ ] Code reviewed and approved

---

## 🚨 Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Smart contract bugs | HIGH | MEDIUM | Thorough testing on testnet, code review |
| Gas price volatility | MEDIUM | HIGH | Dynamic gas estimation, 20% buffer |
| Slippage losses | MEDIUM | MEDIUM | Strict slippage limits, rate locking |
| Transaction failures | LOW | LOW | Retry logic, error handling |
| Pool liquidity drying up | MEDIUM | LOW | Monitor multiple DEXes, fallback pools |
| API rate limits | LOW | MEDIUM | Request throttling, caching |

---

## 📊 Timeline

```
Week 1 (Days 1-7):
├── Day 1: Research & setup ✅
├── Day 2: DeDust contract interface ✅
├── Day 3: DeDust service implementation ✅
├── Day 4: Error handling ✅
├── Day 5: DeDust testing ✅
├── Day 6: Ston.fi contract interface ✅
└── Day 7: Ston.fi service implementation ✅

Week 2 (Days 8-12):
├── Day 8: Ston.fi testing ✅
├── Day 9: ConversionService integration ✅
├── Day 10: Gas optimization ✅
├── Day 11: Mainnet configuration ✅
└── Day 12: Safety checks & monitoring ✅
```

---

## 📝 Checklist

### Pre-Implementation
- [ ] Read DeDust documentation
- [ ] Read Ston.fi documentation
- [ ] Setup testnet wallet with funds
- [ ] Identify testnet pool addresses
- [ ] Create test transaction manually (via TON wallet)

### Implementation
- [ ] Create contract interfaces (DeDust, Ston.fi)
- [ ] Implement executeDeDustSwap()
- [ ] Implement executeStonfiSwap()
- [ ] Add error handling
- [ ] Write integration tests
- [ ] Test on testnet (small amounts first)
- [ ] Update ConversionService
- [ ] Implement gas optimization
- [ ] Add safety checks
- [ ] Setup monitoring

### Testing
- [ ] Unit tests pass (all services)
- [ ] Integration tests pass (testnet)
- [ ] Manual testing successful
- [ ] Gas fees reasonable (<0.1 TON)
- [ ] Output amounts accurate (±1%)
- [ ] Error cases handled gracefully

### Deployment
- [ ] Configure mainnet environment
- [ ] Deploy to staging first
- [ ] Run smoke tests on staging
- [ ] Monitor for 24 hours
- [ ] Deploy to production
- [ ] Monitor closely for 48 hours

---

## 📚 Resources

### Documentation
- DeDust: https://docs.dedust.io/
- Ston.fi: https://docs.ston.fi/
- TON: https://docs.ton.org/develop/dapps/defi/coins
- TonWeb: https://github.com/toncenter/tonweb

### Tools
- TON Explorer: https://tonscan.org/
- Testnet Explorer: https://testnet.tonscan.org/
- TON SDK: https://github.com/ton-org/ton
- Testnet Faucet: https://t.me/testgiver_ton_bot

### Support
- DeDust Telegram: https://t.me/dedust
- Ston.fi Telegram: https://t.me/ston_fi
- TON Developers: https://t.me/tondev

---

## 🎯 Next Steps After Completion

Once smart contract integration is complete:

1. **Week 3**: P2P order matching engine
2. **Week 4**: Webhook dispatcher & settlement processor
3. **Week 5**: Blockchain polling & comprehensive testing
4. **Week 6**: Production deployment
5. **Week 7**: Launch & monitoring

See [NEXT_STEPS.md](./NEXT_STEPS.md) for full roadmap.

---

**Status Updates**: Update this document daily during implementation with progress and blockers.

**Questions?** Open a GitHub issue or ask in Discord #smart-contracts channel.
