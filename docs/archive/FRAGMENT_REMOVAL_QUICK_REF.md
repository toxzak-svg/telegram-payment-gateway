# Fragment Removal - Quick Reference

## Current Status

✅ **Completed:**
- All documentation updated (README, API docs, Architecture docs)
- P2P order infrastructure created (stars_orders, atomic_swaps tables)
- P2P service foundation implemented (StarsP2PService, StarsOrderModel)
- Comprehensive 8-week implementation plan documented

⏳ **Remaining Work:**
- Remove Fragment service code from codebase (fragment.service.ts)
- Implement DEX aggregator (DeDust, Ston.fi integration)
- Update database schema (remove fragment columns, add dex columns)
- Update all services to use P2P/DEX instead of Fragment
- Comprehensive testing and deployment

---

## Fragment References Found (100+ matches)

### 🔴 Critical Files to Modify:

1. **packages/core/src/services/fragment.service.ts** (279 lines)
   - **Action**: DELETE entire file

2. **packages/core/src/services/conversion.service.ts**
   - Remove FragmentService import and usage
   - Replace executeFragmentConversion with executeP2PConversion

3. **packages/core/src/services/fee.service.ts**
   - Replace fragmentFeePercentage → dexFeePercentage
   - Update all fee calculations

4. **packages/core/src/models/conversion.model.ts**
   - Remove fragmentTxId field
   - Add dexPoolId, dexProvider, dexTxHash fields

5. **packages/sdk/src/types.ts**
   - Update fee structure (fragment → dex)
   - Update transaction IDs

6. **packages/api/src/controllers/admin.controller.ts**
   - Update all fragmentFeePercentage references

7. **database/migrations/001_initial_schema.sql**
   - Remove fragment_tx_id, fragment_status columns
   - Remove idx_conversions_fragment_tx index

8. **database/migrations/002_platform_fees.sql**
   - Remove fragment_fee_percentage column

---

## Implementation Priority

### Phase 1: Database (Week 1)
```bash
# Create migrations
database/migrations/008_remove_fragment_columns.sql
database/migrations/009_update_platform_config.sql

# Run migrations
npm run migrate
```

### Phase 2: Services (Week 2-3)
```bash
# New services
packages/core/src/services/dex-aggregator.service.ts
packages/core/src/services/p2p-liquidity.service.ts

# Update existing
packages/core/src/services/conversion.service.ts
packages/core/src/services/fee.service.ts

# Delete obsolete
packages/core/src/services/fragment.service.ts
```

### Phase 3: Types & Models (Week 3)
```bash
# Update
packages/core/src/types/index.ts
packages/core/src/models/conversion.model.ts
packages/sdk/src/types.ts
```

### Phase 4: API (Week 4)
```bash
# New controllers
packages/api/src/controllers/dex.controller.ts

# Update existing
packages/api/src/controllers/admin.controller.ts
packages/api/src/routes/v1.routes.ts
```

### Phase 5: Testing (Week 5)
```bash
# Create
packages/core/src/__tests__/unit/dex-aggregator.test.ts
packages/core/src/__tests__/unit/p2p-liquidity.test.ts
packages/api/src/__tests__/integration/dex-flow.test.ts

# Update
packages/core/src/__tests__/unit/services.test.ts (remove FragmentService tests)
```

---

## Environment Variables to Update

### Remove:
```bash
FRAGMENT_API_KEY=
FRAGMENT_API_URL=
```

### Add:
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

---

## Key Search Commands

### Find remaining Fragment references:
```bash
# TypeScript files
grep -r "fragment\|Fragment" packages/ --include="*.ts" | wc -l

# Database migrations
grep -r "fragment\|Fragment" database/migrations/ --include="*.sql"

# Documentation (should be clean now)
grep -r "fragment\|Fragment" docs/ --include="*.md"
```

### Verify P2P implementation:
```bash
# Check P2P services exist
ls -la packages/core/src/services/stars-p2p.service.ts
ls -la packages/core/src/models/stars-order.model.ts
ls -la packages/api/src/controllers/p2p-orders.controller.ts

# Check database tables
psql $DATABASE_URL -c "\d stars_orders"
psql $DATABASE_URL -c "\d atomic_swaps"
```

---

## Testing Checklist

- [ ] Unit test: DexAggregatorService.getBestRate()
- [ ] Unit test: DexAggregatorService.executeSwap()
- [ ] Unit test: P2PLiquidityService.findBestRoute()
- [ ] Unit test: P2PLiquidityService.executeConversion()
- [ ] Integration test: DEX quote → swap flow
- [ ] Integration test: P2P order creation → matching
- [ ] E2E test: Stars payment → P2P conversion → TON withdrawal
- [ ] Load test: Concurrent conversions
- [ ] Performance test: Order matching speed

---

## Deployment Steps

1. **Pre-deployment:**
   ```bash
   npm run test --workspaces
   npm run lint -- --fix
   npm run build --workspaces
   ```

2. **Database migration:**
   ```bash
   # Backup first!
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   
   # Run migrations
   npm run migrate
   
   # Verify
   npm run migrate:status
   ```

3. **Deploy services:**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

4. **Verify:**
   ```bash
   npm run smoke-test
   curl http://localhost:3000/api/v1/health
   ```

5. **Monitor:**
   - Conversion success rate
   - P2P order match rate
   - DEX API uptime
   - Error logs

---

## Rollback Plan

If issues occur:

1. **Restore database:**
   ```bash
   psql $DATABASE_URL < backup-YYYYMMDD.sql
   ```

2. **Revert code:**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Redeploy previous version:**
   ```bash
   git checkout [previous-commit]
   docker-compose up -d --build
   ```

---

## Success Metrics

- ✅ Zero Fragment API calls
- ✅ Conversion success rate >98%
- ✅ Average conversion time <2 minutes
- ✅ P2P order match rate >80%
- ✅ All tests passing
- ✅ Documentation updated

---

## Next Immediate Steps

1. **Today:**
   - Review implementation plan (`docs/FRAGMENT_REMOVAL_PLAN.md`)
   - Set up DEX API test accounts (DeDust, Ston.fi)
   - Create database migration files

2. **This Week:**
   - Implement DexAggregatorService
   - Update ConversionService
   - Begin unit testing

3. **Next Week:**
   - Complete service layer
   - API controller updates
   - Integration testing

---

## Support & Resources

- **Full Plan**: `docs/FRAGMENT_REMOVAL_PLAN.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **API Docs**: `docs/API.md`
- **Integration Guide**: `docs/INTEGRATION_GUIDE.md`

**Questions?** Open an issue on GitHub or check the comprehensive plan document.
