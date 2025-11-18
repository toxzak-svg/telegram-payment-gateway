# Smart Contract Integration - Quick Start

**For Developers Starting the Smart Contract Integration Work**

This is a condensed version of the full [SMART_CONTRACT_INTEGRATION_PLAN.md](./SMART_CONTRACT_INTEGRATION_PLAN.md).

---

## 🎯 Goal

Replace mock DEX swap implementations with real on-chain transactions through DeDust V2 and Ston.fi smart contracts.

**Files to Update**:
- `packages/core/src/services/dex-aggregator.service.ts` (lines 199, 217)
- Create: `packages/core/src/contracts/dedust.contract.ts`
- Create: `packages/core/src/contracts/stonfi.contract.ts`

---

## ⚡ Quick Setup (Day 1)

```bash
# 1. Install dependencies
npm install @ton/ton @ton/core @ton/crypto tonweb

# 2. Generate testnet wallet
node scripts/generate-ton-wallet.js --testnet

# 3. Get testnet TON
# Visit: https://t.me/testgiver_ton_bot
# Send: /request <your_wallet_address>

# 4. Verify balance
node scripts/check-wallet-balance.js

# 5. Set environment variables
# Add to .env:
TON_MAINNET=false
TON_API_URL=https://testnet.toncenter.com/api/v2/jsonRPC
TON_API_KEY=your_testnet_api_key
TON_WALLET_MNEMONIC="your 24 word mnemonic"
DEDUST_VAULT_ADDRESS=EQD_testnet_address
STONFI_ROUTER_ADDRESS=EQB_testnet_address
```

---

## 📖 Documentation to Read

**Priority 1 (Must Read)**:
- DeDust Docs: https://docs.dedust.io/docs/swaps
- Ston.fi Docs: https://docs.ston.fi/docs/developer-section/api-reference-mainnet
- TON Smart Contracts: https://docs.ton.org/develop/smart-contracts/

**Priority 2 (Reference)**:
- TON SDK: https://github.com/ton-org/ton
- TonWeb Examples: https://github.com/toncenter/tonweb/tree/master/src/contract

---

## 🔨 Implementation Order

### Week 1: DeDust Integration

**Day 2: Contract Interface**
```typescript
// packages/core/src/contracts/dedust.contract.ts
export class DeDustPool implements Contract {
  async sendSwap(provider, via, params: SwapParams, value) {
    const messageBody = beginCell()
      .storeUint(0x25938561, 32) // swap op code
      .storeCoins(params.amountIn)
      .storeCoins(params.minAmountOut)
      .storeUint(params.deadline, 32)
      .storeAddress(params.recipient)
      .endCell();
    
    await provider.internal(via, { value, body: messageBody });
  }
}
```

**Day 3: Service Implementation**
```typescript
// packages/core/src/services/dex-aggregator.service.ts
async executeDeDustSwap(...) {
  // 1. Initialize client & wallet
  const client = new TonClient({ endpoint, apiKey });
  const wallet = WalletContractV4.create({ workchain: 0, publicKey });
  
  // 2. Get pool contract
  const pool = client.open(DeDustPool.createFromAddress(poolId));
  
  // 3. Calculate expected output (x * y = k formula)
  const poolData = await pool.getPoolData();
  const expectedOutput = calculateOutput(amount, poolData);
  
  // 4. Verify slippage
  if (expectedOutput < minReceive) throw Error('SLIPPAGE_EXCEEDED');
  
  // 5. Send swap transaction
  await pool.sendSwap(wallet.sender(secretKey), params, value);
  
  // 6. Wait for confirmation (poll seqno)
  await waitForSeqnoIncrement(wallet, seqno);
  
  // 7. Parse transaction result
  const tx = await client.getTransactions(wallet.address, { limit: 1 });
  const actualOutput = parseSwapOutput(tx[0]);
  
  return { txHash: tx[0].hash(), outputAmount: actualOutput };
}
```

**Day 4: Error Handling**
```typescript
// packages/core/src/services/dex-error-handler.ts
export enum DexErrorCode {
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED',
  // ... more error codes
}

export class DexRetryHandler {
  async executeWithRetry(operation, retryableErrors) {
    // Exponential backoff retry logic
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (isRetryable(error)) {
          await delay(2^attempt * 1000);
          continue;
        }
        throw error;
      }
    }
  }
}
```

**Day 5: Testing**
```bash
# Run testnet integration tests
npm run test:integration -- dedust-swap.test.ts

# Manual test
node packages/core/scripts/test-dedust-swap.js \
  --amount 0.1 \
  --from TON \
  --to USDT \
  --slippage 0.1
```

### Week 2: Ston.fi + Production

**Day 6-7: Ston.fi Implementation** (similar to DeDust but uses router)

**Day 8: Testing**

**Day 9: Update ConversionService**
```typescript
// packages/core/src/services/conversion.service.ts
async executeConversion(conversionId) {
  const conversion = await this.conversionModel.findById(conversionId);
  
  // Get best route from DEX aggregator
  const route = await this.dexAggregator.findBestRoute(...);
  
  // Execute swap (now uses REAL smart contracts!)
  const result = route.provider === 'dedust'
    ? await this.dexAggregator.executeDeDustSwap(...)
    : await this.dexAggregator.executeStonfiSwap(...);
  
  // Update database with results
  await this.conversionModel.update(conversionId, {
    status: 'completed',
    dex_tx_hash: result.txHash,
    actual_amount: result.outputAmount
  });
  
  return result;
}
```

**Day 10: Gas Optimization**

**Day 11-12: Production Config + Safety Checks**

---

## 🧪 Testing Checklist

### Testnet Tests
- [ ] Swap 0.1 TON → USDT (small amount)
- [ ] Swap 1 TON → USDT (medium amount)
- [ ] Verify slippage protection works
- [ ] Test insufficient liquidity error
- [ ] Test invalid pool address error
- [ ] Test transaction timeout handling

### Mainnet Preparation
- [ ] Configure production environment variables
- [ ] Deploy to staging with mainnet config
- [ ] Run smoke tests with real (small) amounts
- [ ] Monitor for 24 hours
- [ ] Gradual rollout (10% → 50% → 100%)

---

## 🚨 Common Pitfalls

1. **Wrong Op Codes**: Each DEX has specific operation codes. Double-check in docs.
2. **Incorrect Units**: TON uses nanotons (1 TON = 1e9 nanotons). Always convert.
3. **Gas Estimation**: Always add 20% buffer to avoid out-of-gas errors.
4. **Deadline Too Short**: Use 10+ minutes for swap deadlines to avoid rejections.
5. **Seqno Not Incrementing**: Transaction might be stuck. Check TON explorer.
6. **Parsing Errors**: Transaction format differs between DEXes. Use correct parser.

---

## 📊 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Swap success rate | >98% | Monitor `swap_logs` table |
| Gas usage | <0.1 TON | Track `gas_used` column |
| Output accuracy | ±1% of expected | Compare `expected_amount` vs `actual_amount` |
| Transaction speed | <2 minutes | Measure time from submit to confirmation |
| Slippage events | <5% of swaps | Count `SLIPPAGE_EXCEEDED` errors |

---

## 🆘 Getting Help

**During Implementation**:
- DeDust support: https://t.me/dedust
- Ston.fi support: https://t.me/ston_fi
- TON developers: https://t.me/tondev

**Testing Issues**:
- Check TON testnet explorer: https://testnet.tonscan.org/
- Verify pool addresses in DEX documentation
- Test with official DEX web interfaces first

**Code Issues**:
- Review example transactions on explorer
- Check TonWeb examples: https://github.com/toncenter/tonweb
- Ask in project Discord: #smart-contracts channel

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `packages/core/src/services/dex-aggregator.service.ts` | Main swap execution logic |
| `packages/core/src/contracts/dedust.contract.ts` | DeDust smart contract interface |
| `packages/core/src/contracts/stonfi.contract.ts` | Ston.fi smart contract interface |
| `packages/core/src/services/dex-error-handler.ts` | Error handling & retry logic |
| `packages/core/src/services/conversion.service.ts` | High-level conversion orchestration |
| `packages/core/src/__tests__/integration/dedust-swap.test.ts` | DeDust integration tests |

---

## ⏱️ Time Estimates

- **Research & Setup**: 4-6 hours
- **DeDust Implementation**: 16-20 hours
- **Ston.fi Implementation**: 12-16 hours
- **Testing & Debugging**: 8-12 hours
- **Production Prep**: 6-8 hours

**Total**: 46-62 hours (≈ 10-12 working days)

---

## ✅ Daily Checklist

### Day 1
- [ ] Read DeDust and Ston.fi docs
- [ ] Setup testnet wallet
- [ ] Get testnet TON from faucet
- [ ] Install required packages
- [ ] Test manual swap on DEX website

### Day 2
- [ ] Create DeDust contract interface
- [ ] Write getPoolData() method
- [ ] Write sendSwap() method
- [ ] Test contract compilation

### Day 3
- [ ] Implement executeDeDustSwap() service method
- [ ] Add wallet initialization
- [ ] Add transaction signing logic
- [ ] Add seqno polling

### Day 4
- [ ] Create error handler classes
- [ ] Implement retry logic
- [ ] Add error code enum
- [ ] Write unit tests

### Day 5
- [ ] Write integration tests
- [ ] Run tests on testnet
- [ ] Debug any failures
- [ ] Document issues found

### Days 6-8
- [ ] Repeat Days 2-5 for Ston.fi
- [ ] Test both DEXes work correctly
- [ ] Compare gas usage between them

### Days 9-10
- [ ] Update ConversionService
- [ ] Implement gas optimization
- [ ] Add safety checks
- [ ] Write monitoring code

### Days 11-12
- [ ] Configure mainnet environment
- [ ] Deploy to staging
- [ ] Run production smoke tests
- [ ] Monitor and fix issues

---

**Full Details**: See [SMART_CONTRACT_INTEGRATION_PLAN.md](./SMART_CONTRACT_INTEGRATION_PLAN.md) for complete implementation guide with code examples.

**Questions?** Check the plan document or ask in Discord.

Good luck! 🚀
