# Fragment Removal & P2P Liquidity Pool Implementation Plan

**Status**: Implementation Roadmap  
**Version**: 1.0  
**Last Updated**: 2024

---

## Executive Summary

This document outlines the comprehensive plan to remove all Fragment.com dependencies and replace them with a decentralized P2P liquidity pool system using DeDust and Ston.fi DEX protocols.

**Goals:**
- ✅ Remove all Fragment API integrations
- ✅ Implement P2P order matching for Stars ↔ TON swaps
- ✅ Integrate DeDust and Ston.fi DEX protocols for liquidity
- ✅ Update database schema to remove Fragment columns
- ✅ Migrate fee structure from Fragment fees to DEX fees
- ✅ Update all documentation and types
- ✅ Comprehensive testing of P2P flow

---

## Phase 1: Database Schema Migration (Week 1)

### 1.1 Create Migration for Fragment Column Removal

**File**: `database/migrations/008_remove_fragment_columns.sql`

```sql
-- Remove Fragment-specific columns from conversions table
ALTER TABLE conversions 
  DROP COLUMN IF EXISTS fragment_tx_id,
  DROP COLUMN IF EXISTS fragment_status;

-- Add DEX-specific columns
ALTER TABLE conversions 
  ADD COLUMN IF NOT EXISTS dex_pool_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dex_provider VARCHAR(50) CHECK (dex_provider IN ('dedust', 'stonfi', 'p2p')),
  ADD COLUMN IF NOT EXISTS dex_tx_hash VARCHAR(255);

-- Update fee_breakdown JSONB structure (remove fragment, add dex)
UPDATE conversions 
SET fee_breakdown = jsonb_set(
  fee_breakdown - 'fragment',
  '{dex}',
  COALESCE(fee_breakdown->'fragment', '0')::jsonb
)
WHERE fee_breakdown ? 'fragment';

-- Drop old index
DROP INDEX IF EXISTS idx_conversions_fragment_tx;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_conversions_dex_pool ON conversions(dex_pool_id);
CREATE INDEX IF NOT EXISTS idx_conversions_dex_provider ON conversions(dex_provider);
```

### 1.2 Update Platform Config Table

**File**: `database/migrations/009_update_platform_config.sql`

```sql
-- Remove Fragment fee configuration
ALTER TABLE platform_config
  DROP COLUMN IF EXISTS fragment_fee_percentage;

-- Add DEX configuration
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS dex_fee_percentage DECIMAL(5,4) DEFAULT 0.0050, -- 0.5%
  ADD COLUMN IF NOT EXISTS dex_slippage_tolerance DECIMAL(5,4) DEFAULT 0.0050, -- 0.5%
  ADD COLUMN IF NOT EXISTS preferred_dex_provider VARCHAR(50) DEFAULT 'dedust';

-- Update existing records
UPDATE platform_config 
SET dex_fee_percentage = 0.0050
WHERE dex_fee_percentage IS NULL;
```

### 1.3 Migration Checklist

- [ ] Create migration files
- [ ] Test migrations on local database
- [ ] Verify data integrity after migration
- [ ] Create rollback scripts
- [ ] Document breaking changes

---

## Phase 2: Service Layer Refactoring (Week 2-3)

### 2.1 Remove Fragment Service

**Action**: Delete `packages/core/src/services/fragment.service.ts`

**Dependencies to update:**
- `conversion.service.ts` (lines 2, 46, 51)
- Any test files importing FragmentService

### 2.2 Create DEX Aggregator Service

**File**: `packages/core/src/services/dex-aggregator.service.ts`

```typescript
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
    const [dedustQuote, stonfiQuote] = await Promise.all([
      this.getDeDustQuote(fromToken, toToken, amount),
      this.getStonfiQuote(fromToken, toToken, amount),
    ]);

    // Compare and return best rate
    const bestQuote = dedustQuote.outputAmount > stonfiQuote.outputAmount
      ? dedustQuote
      : stonfiQuote;

    return bestQuote;
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
      });

      return {
        inputAmount: amount,
        outputAmount: parseFloat(response.data.outputAmount),
        rate: parseFloat(response.data.rate),
        pools: response.data.pools.map((p: any) => ({
          provider: 'dedust' as const,
          poolId: p.poolAddress,
          rate: parseFloat(p.rate),
          liquidity: parseFloat(p.liquidity),
          fee: parseFloat(p.fee),
          slippage: parseFloat(p.slippage),
        })),
        bestPool: response.data.pools[0],
        estimatedGas: parseFloat(response.data.estimatedGas),
        route: response.data.route,
      };
    } catch (error) {
      console.error('DeDust API error:', error);
      throw new Error('Failed to get DeDust quote');
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
      });

      return {
        inputAmount: amount,
        outputAmount: parseFloat(response.data.ask_units),
        rate: parseFloat(response.data.swap_rate),
        pools: [{
          provider: 'stonfi' as const,
          poolId: response.data.pool_address,
          rate: parseFloat(response.data.swap_rate),
          liquidity: parseFloat(response.data.liquidity),
          fee: parseFloat(response.data.fee_percent),
          slippage: parseFloat(response.data.slippage_tolerance),
        }],
        bestPool: response.data.pools?.[0] || null,
        estimatedGas: parseFloat(response.data.estimated_gas || '0.05'),
        route: response.data.route || [fromToken, toToken],
      };
    } catch (error) {
      console.error('Ston.fi API error:', error);
      throw new Error('Failed to get Ston.fi quote');
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
    // TODO: Implement actual DeDust swap execution
    // This requires TON smart contract interaction
    throw new Error('DeDust swap execution not yet implemented');
  }

  private async executeStonfiSwap(
    poolId: string,
    fromToken: string,
    toToken: string,
    amount: number,
    minOutput: number
  ): Promise<{ txHash: string; outputAmount: number }> {
    // TODO: Implement actual Ston.fi swap execution
    // This requires TON smart contract interaction
    throw new Error('Ston.fi swap execution not yet implemented');
  }
}
```

### 2.3 Create P2P Liquidity Service

**File**: `packages/core/src/services/p2p-liquidity.service.ts`

```typescript
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

export class P2PLiquidityService {
  private pool: Pool;
  private dexAggregator: DexAggregatorService;
  private p2pService: StarsP2PService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.dexAggregator = new DexAggregatorService();
    this.p2pService = new StarsP2PService(pool);
  }

  /**
   * Find best conversion route (P2P or DEX)
   */
  async findBestRoute(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ): Promise<ConversionRoute> {
    // Query both P2P order book and DEX pools in parallel
    const [p2pOrders, dexQuote] = await Promise.all([
      this.getP2PLiquidity(fromCurrency, toCurrency, amount),
      this.dexAggregator.getBestRate(fromCurrency, toCurrency, amount),
    ]);

    // Compare routes
    const routes: ConversionRoute[] = [];

    // P2P route
    if (p2pOrders.totalLiquidity >= amount) {
      routes.push({
        sources: [{
          type: 'p2p',
          rate: p2pOrders.averageRate,
          liquidity: p2pOrders.totalLiquidity,
          fee: 0.001, // 0.1% P2P fee
          executionTime: 60, // ~1 minute
        }],
        totalRate: p2pOrders.averageRate,
        totalFee: amount * 0.001,
        estimatedTime: 60,
        confidence: 0.95,
      });
    }

    // DEX route
    routes.push({
      sources: [{
        type: 'dex',
        provider: dexQuote.bestPool.provider,
        rate: dexQuote.rate,
        liquidity: dexQuote.bestPool.liquidity,
        fee: dexQuote.bestPool.fee,
        executionTime: 30, // ~30 seconds
      }],
      totalRate: dexQuote.rate,
      totalFee: dexQuote.bestPool.fee,
      estimatedTime: 30,
      confidence: 0.98,
    });

    // Return best route (highest net output)
    return routes.sort((a, b) => {
      const aOutput = amount * a.totalRate - a.totalFee;
      const bOutput = amount * b.totalRate - b.totalFee;
      return bOutput - aOutput;
    })[0];
  }

  /**
   * Execute conversion through best available route
   */
  async executeConversion(
    conversionId: string,
    route: ConversionRoute
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const source = route.sources[0];

    try {
      if (source.type === 'p2p') {
        return await this.executeP2PConversion(conversionId);
      } else {
        return await this.executeDexConversion(conversionId, source);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getP2PLiquidity(
    fromCurrency: string,
    toCurrency: string,
    amount: number
  ) {
    // Query P2P order book
    const orders = await this.pool.query(`
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
      totalLiquidity: parseFloat(orders.rows[0]?.total_liquidity || '0'),
      averageRate: parseFloat(orders.rows[0]?.average_rate || '0'),
      orderCount: parseInt(orders.rows[0]?.order_count || '0'),
    };
  }

  private async executeP2PConversion(conversionId: string) {
    // TODO: Implement P2P order matching and execution
    throw new Error('P2P conversion execution not yet implemented');
  }

  private async executeDexConversion(conversionId: string, source: LiquiditySource) {
    // TODO: Implement DEX swap execution
    throw new Error('DEX conversion execution not yet implemented');
  }
}
```

### 2.4 Update Conversion Service

**File**: `packages/core/src/services/conversion.service.ts`

**Changes:**
1. Remove `FragmentService` import (line 2)
2. Remove `fragmentService` property (line 46)
3. Remove `fragmentService` initialization (line 51)
4. Replace `executeFragmentConversion()` with `executeP2PConversion()`
5. Update fee breakdown to use `dex` instead of `fragment`

### 2.5 Update Fee Service

**File**: `packages/core/src/services/fee.service.ts`

**Changes:**
1. Replace `fragmentFeePercentage` with `dexFeePercentage` (lines 5, 49, 65)
2. Update `calculateFeeBreakdown()` to return `dex` fee instead of `fragment`
3. Update database queries to use `dex_fee_percentage`

---

## Phase 3: Type Definitions & Models (Week 3)

### 3.1 Update Type Definitions

**File**: `packages/core/src/types/index.ts`

**Changes:**
```typescript
// Replace
fragment: number;

// With
dex: number;
```

### 3.2 Update Models

**File**: `packages/core/src/models/conversion.model.ts`

**Changes:**
```typescript
// Remove
fragmentTxId?: string;

// Add
dexPoolId?: string;
dexProvider?: 'dedust' | 'stonfi' | 'p2p';
dexTxHash?: string;

// Update fee breakdown
fragment?: number; // REMOVE
dex?: number; // ADD
```

### 3.3 Update SDK Types

**File**: `packages/sdk/src/types.ts`

**Changes:**
```typescript
// Line 50, 91 - Remove
fragment?: number;

// Add
dex?: number;

// Line 86 - Remove
fragmentTxId?: string;

// Add
dexPoolId?: string;
dexProvider?: string;
```

---

## Phase 4: API Controllers & Routes (Week 4)

### 4.1 Update Admin Controller

**File**: `packages/api/src/controllers/admin.controller.ts`

**Changes:**
```typescript
// Replace all instances of:
fragmentFeePercentage → dexFeePercentage
fragment_fee_percentage → dex_fee_percentage
```

### 4.2 Create DEX Integration Endpoints

**File**: `packages/api/src/controllers/dex.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { DexAggregatorService } from '@tg-payment/core';

export class DexController {
  static async getQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromToken, toToken, amount } = req.query;
      
      if (!fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'Missing required parameters' },
        });
      }

      const dexAggregator = new DexAggregatorService();
      const quote = await dexAggregator.getBestRate(
        fromToken as string,
        toToken as string,
        parseFloat(amount as string)
      );

      res.json({ success: true, data: quote });
    } catch (error: any) {
      next(error);
    }
  }

  static async executeSwap(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider, poolId, fromToken, toToken, amount, minOutput } = req.body;

      if (!provider || !poolId || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARAMS', message: 'Missing required parameters' },
        });
      }

      const dexAggregator = new DexAggregatorService();
      const result = await dexAggregator.executeSwap(
        provider,
        poolId,
        fromToken,
        toToken,
        amount,
        minOutput || amount * 0.95
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      next(error);
    }
  }
}
```

### 4.3 Update Routes

**File**: `packages/api/src/routes/v1.routes.ts`

**Add:**
```typescript
import { DexController } from '../controllers/dex.controller';

// DEX endpoints
router.get('/dex/quote', DexController.getQuote);
router.post('/dex/swap', authenticateApiKey, DexController.executeSwap);
```

---

## Phase 5: Testing & Validation (Week 5)

### 5.1 Unit Tests

**Create:**
- `packages/core/src/__tests__/unit/dex-aggregator.test.ts`
- `packages/core/src/__tests__/unit/p2p-liquidity.test.ts`
- `packages/core/src/__tests__/unit/conversion.service.test.ts` (update)

### 5.2 Integration Tests

**Create:**
- `packages/api/src/__tests__/integration/dex-flow.test.ts`
- `packages/api/src/__tests__/integration/p2p-order-matching.test.ts`

### 5.3 Update Existing Tests

**File**: `packages/core/src/__tests__/unit/services.test.ts`

**Action**: Remove `FragmentService` tests (lines 4, 147+)

### 5.4 Test Checklist

- [ ] Unit tests for DexAggregatorService
- [ ] Unit tests for P2PLiquidityService
- [ ] Integration tests for DEX quote/swap flow
- [ ] Integration tests for P2P order matching
- [ ] End-to-end test: Stars payment → P2P conversion → TON withdrawal
- [ ] Performance tests for order matching
- [ ] Load tests for concurrent conversions

---

## Phase 6: Environment & Configuration (Week 5)

### 6.1 Update Environment Variables

**Add to `.env`:**
```bash
# DEX Integration
DEDUST_API_URL=https://api.dedust.io
STONFI_API_URL=https://api.ston.fi
DEX_SLIPPAGE_TOLERANCE=0.005

# P2P Configuration
P2P_POOL_REFRESH_INTERVAL=30
P2P_MIN_ORDER_SIZE=100
P2P_MAX_ORDER_SIZE=100000
```

**Remove from `.env`:**
```bash
FRAGMENT_API_KEY=  # REMOVE
FRAGMENT_API_URL=  # REMOVE
```

### 6.2 Update Configuration Files

**File**: `packages/core/src/config/index.ts`

**Changes:**
```typescript
// Remove
fragmentApiKey: process.env.FRAGMENT_API_KEY,
fragmentApiUrl: process.env.FRAGMENT_API_URL,

// Add
dedustApiUrl: process.env.DEDUST_API_URL || 'https://api.dedust.io',
stonfiApiUrl: process.env.STONFI_API_URL || 'https://api.ston.fi',
dexSlippageTolerance: parseFloat(process.env.DEX_SLIPPAGE_TOLERANCE || '0.005'),
p2pPoolRefreshInterval: parseInt(process.env.P2P_POOL_REFRESH_INTERVAL || '30'),
```

---

## Phase 7: Documentation Updates (Week 6)

### 7.1 Update API Documentation

**File**: `docs/API.md`

**Changes:**
- ✅ Already updated `fragment` → `dex` in fee structure
- ✅ Already updated `fragmentTxId` → `dexPoolId`
- [ ] Add new DEX endpoints documentation
- [ ] Add P2P order endpoints documentation

### 7.2 Update Architecture Documentation

**File**: `docs/ARCHITECTURE.md`

**Changes:**
- ✅ Already updated Fragment Service → P2P Pool Service
- [ ] Add DEX integration diagram
- [ ] Add P2P order matching flow diagram

### 7.3 Update Integration Guide

**File**: `docs/INTEGRATION_GUIDE.md`

**Changes:**
- [ ] Update payment flow to show P2P/DEX options
- [ ] Add examples for DEX quote/swap
- [ ] Add examples for P2P orders

### 7.4 Update Development Guide

**File**: `docs/DEVELOPMENT.md`

**Changes:**
- ✅ Already updated environment variables
- [ ] Add DEX setup instructions
- [ ] Add P2P service testing guide

---

## Phase 8: Deployment & Migration (Week 6-7)

### 8.1 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database migrations tested
- [ ] Rollback scripts prepared
- [ ] Environment variables configured
- [ ] DEX API credentials obtained
- [ ] Monitoring alerts configured

### 8.2 Migration Strategy

**Step 1: Deploy to Staging**
```bash
# 1. Run database migrations
npm run migrate

# 2. Deploy new services
docker-compose up -d

# 3. Run smoke tests
npm run smoke-test

# 4. Monitor for 24 hours
```

**Step 2: Production Deployment**
```bash
# 1. Schedule maintenance window
# 2. Backup production database
# 3. Run migrations with rollback plan
# 4. Deploy new code
# 5. Monitor conversion success rates
# 6. Verify P2P order matching
```

### 8.3 Feature Flags

**Implement gradual rollout:**
```typescript
// config/feature-flags.ts
export const FEATURE_FLAGS = {
  USE_P2P_CONVERSION: process.env.FEATURE_P2P_CONVERSION === 'true',
  USE_DEX_AGGREGATOR: process.env.FEATURE_DEX_AGGREGATOR === 'true',
  FALLBACK_TO_FRAGMENT: process.env.FEATURE_FRAGMENT_FALLBACK === 'true',
};
```

### 8.4 Monitoring & Alerting

**Key Metrics to Monitor:**
- Conversion success rate (target: >98%)
- Average conversion time (target: <2 minutes)
- P2P order match rate (target: >80%)
- DEX API uptime (target: >99.5%)
- Smart contract gas costs

**Alerts:**
- Conversion failure rate >5%
- DEX API errors >10 per minute
- P2P order matching stopped
- Smart contract execution failures

---

## Phase 9: Cleanup & Optimization (Week 8)

### 9.1 Code Cleanup

**Delete obsolete files:**
```bash
rm packages/core/src/services/fragment.service.ts
rm packages/core/src/services/derect-conversion.service.ts.bak
rm packages/core/src/services/withdrawl.service.ts.bak
```

**Remove dead code:**
- Remove all Fragment references from comments
- Remove unused imports
- Remove deprecated functions

### 9.2 Performance Optimization

**P2P Order Matching:**
- Add database indexes on `stars_orders.rate`
- Implement order book caching (Redis)
- Optimize matching algorithm

**DEX Integration:**
- Implement rate caching (30-second TTL)
- Add connection pooling for DEX APIs
- Implement circuit breaker pattern

### 9.3 Documentation Cleanup

- [ ] Remove all Fragment references from comments
- [ ] Update all README files
- [ ] Create migration guide for existing users
- [ ] Create video tutorials for P2P features

---

## Summary of Fragment References to Remove

### Code Files (TypeScript)

1. **packages/core/src/services/fragment.service.ts**
   - **Action**: DELETE entire file (279 lines)

2. **packages/core/src/services/conversion.service.ts**
   - Line 2: Remove `import { FragmentService }`
   - Line 46: Remove `private fragmentService: FragmentService;`
   - Line 51: Remove `this.fragmentService = new FragmentService(tonWalletAddress);`
   - Line 76: Change `fragment: feeBreakdown.fragment` → `dex: feeBreakdown.dex`
   - Lines 234-236: Remove `executeFragmentConversion` call
   - Lines 250-290: Replace `executeFragmentConversion()` method

3. **packages/core/src/services/fee.service.ts**
   - Line 5: Change `fragmentFeePercentage` → `dexFeePercentage`
   - Line 13: Change `fragment: number` → `dex: number`
   - Lines 49, 65, 81, 86, 88: Update all fragment references to dex

4. **packages/core/src/services/direct-conversion.service.ts**
   - Lines 46, 60, 79, 98, 115, 180, 207, 299: Remove comments mentioning Fragment

5. **packages/core/src/models/conversion.model.ts**
   - Line 13: Remove `fragmentTxId?: string;`
   - Line 44: Change `fragment?: number` → `dex?: number`
   - Line 106: Remove `fragmentTxId?: string;`
   - Line 261: Change `fragmentTxId` → `dexPoolId`

6. **packages/core/src/types/index.ts**
   - Line 69: Change `fragment: number` → `dex: number`

7. **packages/core/src/__tests__/unit/services.test.ts**
   - Line 4: Remove `import { FragmentService }`
   - Line 147+: Remove `FragmentService` tests

8. **packages/sdk/src/types.ts**
   - Lines 50, 91: Change `fragment?: number` → `dex?: number`
   - Line 86: Change `fragmentTxId?: string` → `dexPoolId?: string`

9. **packages/api/src/controllers/admin.controller.ts**
   - Lines 210, 237, 252-254: Change all `fragmentFeePercentage` → `dexFeePercentage`

### Database Files (SQL)

10. **database/migrations/001_initial_schema.sql**
    - Line 59: Remove `fragment_tx_id VARCHAR(255),`
    - Line 60: Remove `fragment_status VARCHAR(50),`
    - Line 70: Change `"fragment": 0` → `"dex": 0`
    - Line 196: Remove `idx_conversions_fragment_tx` index

11. **database/migrations/002_platform_fees.sql**
    - Line 35: Remove `fragment_fee_percentage DECIMAL(5,4) DEFAULT 0.0050,`
    - Lines 82, 88: Remove fragment fee references

### Documentation (Already Completed ✅)

12. **docs/API.md** - ✅ DONE
13. **docs/ARCHITECTURE.md** - ✅ DONE
14. **docs/DEVELOPMENT.md** - ✅ DONE
15. **README.md** - ✅ DONE
16. **.github/copilot-instructions.md** - ✅ DONE

---

## Implementation Timeline

| Week | Focus | Deliverables |
|------|-------|-------------|
| Week 1 | Database Migration | Migrations 008-009, schema updates |
| Week 2 | Service Layer | DexAggregatorService, P2PLiquidityService |
| Week 3 | Service Integration | Update ConversionService, FeeService, models |
| Week 4 | API Layer | DEX controllers, routes, SDK updates |
| Week 5 | Testing | Unit tests, integration tests, E2E tests |
| Week 6 | Documentation | API docs, diagrams, migration guide |
| Week 7 | Deployment | Staging → Production rollout |
| Week 8 | Optimization | Performance tuning, monitoring, cleanup |

---

## Success Criteria

✅ **Must Have:**
- [ ] Zero Fragment API calls in production
- [ ] All database columns migrated
- [ ] P2P order matching functional
- [ ] DEX integration complete (DeDust + Ston.fi)
- [ ] All tests passing (>95% coverage)
- [ ] Documentation updated
- [ ] Conversion success rate >98%

🎯 **Should Have:**
- [ ] Conversion time <2 minutes average
- [ ] P2P order match rate >80%
- [ ] DEX fallback working
- [ ] Monitoring dashboards
- [ ] Performance optimizations

🌟 **Nice to Have:**
- [ ] Multi-DEX routing optimization
- [ ] Advanced order types (limit, stop-loss)
- [ ] Liquidity provider incentives
- [ ] Real-time rate streaming

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| DEX API downtime | HIGH | Implement fallback to secondary DEX, cache rates |
| P2P liquidity low | MEDIUM | Ensure DEX liquidity always available |
| Smart contract bugs | HIGH | Extensive testing, audit before production |
| Migration data loss | HIGH | Full database backups, rollback scripts |
| Performance degradation | MEDIUM | Load testing, gradual rollout |

---

## Next Steps

1. **Immediate (Today)**
   - Create database migration files
   - Set up DEX API test accounts
   - Start DexAggregatorService implementation

2. **This Week**
   - Complete service layer refactoring
   - Update type definitions
   - Begin unit testing

3. **Next Week**
   - API controller implementation
   - Integration testing
   - Documentation updates

4. **Following Weeks**
   - Staging deployment
   - Production migration
   - Performance optimization

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Ready for Implementation  
**Approved By**: Development Team
