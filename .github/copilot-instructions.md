# Copilot Instructions for Telegram Payment Gateway

**Status**: Decentralized P2P payment processor | Telegram Stars → TON → Fiat conversions | P2P liquidity pools (no intermediaries)

This codebase is a **monorepo payment gateway** converting Telegram Stars to TON cryptocurrency through **decentralized P2P liquidity pools**. No centralized exchanges, no KYC, truly permissionless. Built with TypeScript, Express, PostgreSQL, and npm workspaces for solo developer productivity with AI assistance.

## Quick Context

- **Tech Stack**: TypeScript 5.x, Node.js 20.x, Express 4.x, PostgreSQL 16.x, TonWeb/TON SDK
- **Architecture**: Microservices with npm workspaces (monorepo)
- **Key Constraint**: No centralized exchanges—P2P liquidity pools only (DeDust, Ston.fi)
- **Deployment**: Docker + Docker Compose for local dev; Render/Railway for production
- **Development Timeline**: 16-week phased rollout (see Development Timeline below)

## Architecture Overview

**Five-package monorepo structure:**
- `packages/core`: Business logic (services, models, types). **Always import services from here**
- `packages/api`: Express REST API with controllers, middleware, routes
- `packages/sdk`: Client library for developers
- `packages/worker`: Background jobs (deposit monitoring, rate updates, webhook dispatch)
- `dashboard`: (Optional) Developer dashboard for API management

**Key architectural principle**: Services are stateless handlers; API layer is thin (validation + response formatting); database operations flow through models; background workers handle async tasks; P2P liquidity pools provide decentralized conversion rates.

**Critical data flows:**
1. **Payment webhook** → `PaymentController.handleTelegramWebhook()` → `PaymentModel.create()` + `TelegramService` → database
2. **Deposit monitoring** → `TonBlockchainService.monitorDeposits()` → `WalletManagerService` verifies confirmations → triggers conversion
3. **P2P rate discovery** → `P2PLiquidityService` queries DeDust & Ston.fi → best rate selected → conversion executed
4. **Manual TON withdrawal** → User sends Stars via Telegram app → receives deposit address → transfers TON manually → gateway confirms on-chain → triggers P2P swap
5. **Rate aggregation** → `DexAggregator` + `RateAggregator` pull from CoinGecko/DeDust/Ston.fi/CoinMarketCap → cached in memory with TTL

## Payment Flow Details

**P2P Liquidity Pool Flow:**
```
User pays with Telegram Stars ($10 USD value)
↓
PaymentController receives webhook with successful_payment
↓
PaymentService validates & creates payment record (status: received)
↓
P2PLiquidityService queries DEX pools (DeDust, Ston.fi)
↓
Best rate selected from decentralized liquidity sources
↓
Generate deposit address using TonBlockchainService.createCustodyWallet()
↓
User manually converts Stars → TON in Telegram app
↓
User sends TON to provided deposit address
↓
TonBlockchainService.monitorDeposits() detects incoming transaction
↓
WalletManagerService verifies 10+ blockchain confirmations
↓
Payment status: ton_confirmed (manual withdrawal verified)
↓
P2PLiquidityService executes swap through best DEX pool
↓
Conversion processed via smart contract interaction
↓
Developer webhook sent with conversion result
↓
Settlement triggered → funds available for withdrawal
```

**Status State Machine:**
- **Payments**: `pending` → `received` → `awaiting_ton` → `ton_pending` → `ton_confirmed` → `converting` → `settled` → `failed`
- **Conversions**: `pending` → `rate_locked` → `awaiting_ton` → `ton_received` → `converting_fiat` → `completed` → `failed`
- **Deposits**: `pending` → `awaiting_confirmation` → `confirmed` → `expired` → `failed`

**Environment setup:**
```bash
npm install                           # Install all workspaces
docker-compose up -d                  # Start PostgreSQL (localhost:5432)
npm run migrate                        # Run migrations
npm run dev                            # Start all packages in dev mode (watches TS)
```

**Testing & validation:**
```bash
npm run test --workspaces             # Run Jest across all packages
npm run lint -- --fix                 # ESLint + TypeScript checking
npm run build --workspaces            # Compile TypeScript
```

**Database operations:**
- Migrations in `database/migrations/` (numbered SQL files). Run with `npm run migrate`
- Schema includes: users, payments, conversions, settlements, fee_collections, withdrawals
- Use `pg-promise` for queries. Example: `db.oneOrNone('SELECT * FROM users WHERE id = $1', [id])`

**Critical Environment Variables (.env):**
```bash
# Database (PostgreSQL 16+)
DATABASE_URL=postgresql://user:password@localhost:5432/tg_payment_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# TON Blockchain (Direct P2P Integration)
TON_WALLET_MNEMONIC=your 24 word mnemonic phrase
TON_API_KEY=your_tonx_key
TON_API_URL=https://toncenter.com/api/v2/jsonRPC
TON_MAINNET=true
TON_WORKCHAIN=0

# P2P DEX Integration
DEDUST_API_URL=https://api.dedust.io
STONFI_API_URL=https://api.ston.fi
DEX_SLIPPAGE_TOLERANCE=0.5

# Exchange Rates
COINGECKO_API_KEY=optional
COINMARKETCAP_API_KEY=optional

# Security
API_SECRET_KEY=random_secret
JWT_SECRET=jwt_secret
WALLET_ENCRYPTION_KEY=256_bit_hex_key

# Conversion Settings (P2P Liquidity Pools)
MIN_CONVERSION_STARS=100
RATE_LOCK_DURATION_SECONDS=300
MAX_PENDING_CONVERSIONS=10
P2P_POOL_REFRESH_INTERVAL=30
```

## Code Patterns & Conventions

### Service Layer (packages/core/src/services/)
Services are **stateless handlers** with static/instance methods. Example:
```typescript
// payment.service.ts
export class PaymentService {
  static async processSuccessfulPayment(payload: any) {
    // Validate, create records, return result
    // Never maintains state between calls
  }
}
```

**Key services (implementation priority order):**
1. `ton-blockchain.service.ts`: TonWeb SDK integration—wallet creation, deposit monitoring, transaction verification, balance checks
2. `wallet-manager.service.ts`: Custody wallet management, deposit address generation, encryption/decryption
3. `telegram.service.ts`: Telegram Bot API webhooks, payment verification
4. `payment-processor.service.ts`: Payment state machine (pending → received → awaiting_ton → ton_pending → ton_confirmed → converting → settled)
5. `dex-aggregator.service.ts`: DEX rate aggregation (DeDust, Ston.fi APIs)
6. `rate.aggregator.ts`: Multi-source exchange rates (CoinGecko, DEX pools, CoinMarketCap) with fallback logic
7. `settlement.service.ts`: Fiat conversion tracking and payout processing
8. `reconciliation.service.ts`: Periodic state consistency validation
9. `webhook.service.ts`: Async webhook delivery to developers with retry logic

### Models (packages/core/src/models/)
Database access layer using `pg-promise`. Always returns objects/arrays, handles null cases:
```typescript
export class PaymentModel {
  constructor(private db: IDatabase<any>) {}
  
  async create(data: CreatePaymentInput): Promise<Payment> {
    return this.db.one('INSERT INTO payments ... RETURNING *', [data]);
  }
}
```

### Controllers (packages/api/src/controllers/)
**Thin HTTP layer**—validate input, call service, format response:
```typescript
static async createPayment(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Validate & extract
    const { amount } = req.body;
    if (!amount) throw new Error('Amount required');
    
    // 2. Call service
    const result = await PaymentService.create(amount);
    
    // 3. Respond with standardized format
    res.json({ success: true, data: result });
  } catch (err) {
    next(err); // Pass to error middleware
  }
}
```

### Authentication & Authorization
- **API Key auth**: `x-api-key` header (format: `pk_*`). Middleware extracts user from database
- **User context**: Attached to `req.user` in `auth.middleware.ts`
- **Route protection**: Apply `authenticateApiKey` middleware on protected routes

### Error Handling
- Throw custom errors with `code` and `message` properties
- Global error middleware in `error.middleware.ts` converts to HTTP responses
- Error format: `{ success: false, error: { code: 'ERROR_TYPE', message: '...' } }`

### Database Connection
- Singleton pattern: `getDatabase()` returns shared connection pool
- Configured in `packages/api/src/db/connection.ts` and `packages/core/src/db/connection.ts`
- Pool: 2-10 connections (configurable via `DATABASE_POOL_MIN/MAX`)

## Important Patterns & Gotchas

1. **Workspace imports**: When adding features to API, import services/models from `@tg-payment/core`, not relative paths
   ```typescript
   import { PaymentService, PaymentModel } from '@tg-payment/core';  // ✅
   // NOT: import from '../../../core/src/services/...'              // ❌
   ```

2. **Rate Locking**: Conversions can lock exchange rates for `RATE_LOCK_DURATION_SECONDS` (env var). Check `rate_locked_until` timestamp
   ```typescript
   const isRateLocked = conversion.rate_locked_until > Date.now() / 1000;
   ```

3. **Fee Structure**: Always calculate using `FeeService`. Fees have four components (Telegram, Platform, TON, Exchange)
   ```typescript
   const fees = await FeeService.calculate(starsAmount, targetCurrency);
   // Returns: { platform: X, telegram: Y, ton: Z, exchange: W, total: X+Y+Z+W }
   ```

4. **TON Integration**: Direct blockchain transfers via P2P liquidity pools. Requires `TON_WALLET_MNEMONIC` (24-word seed)
   - Wallet version: TON wallet v4 or higher
   - Network: Mainnet/testnet (configured by `TON_MAINNET`)
   - Always verify on-chain with block height confirmation
   - P2P DEX integration: DeDust, Ston.fi smart contracts

5. **Reconciliation**: `ReconciliationService` validates state consistency. Run periodically to catch stuck payments/conversions
   ```typescript
   const issues = await ReconciliationService.checkConsistency();
   // Returns stale/orphaned records needing attention
   ```

6. **Webhook Delivery**: Retry logic in `WebhookService`. Webhooks to user-configured `webhook_url` include HMAC signature

7. **Status State Machine**:
   - **Payments**: `pending` → `received` → `converting` → `converted` → `settled`
   - **Conversions**: `pending` → `rate_locked` → `phase1_prepared` → `phase2_committed` → `phase3_confirmed` → `completed`
   - **Withdrawals**: `pending` → `submitted` → `processing` → `completed`

8. **Rate Aggregation**: `RateAggregator` queries CoinGecko/CoinMarketCap. Fallback to cached rate if APIs timeout. Configure via `COINGECKO_API_KEY` and `COINMARKETCAP_API_KEY` env vars

## Testing & Debugging

**Test scripts** in `packages/api/scripts/`:
- `test-auth.js`: Validate API key flow
- `test-payment.js`: Simulate webhook
- `test-conversion.js`: Quote → conversion flow
- `test-fees.js`: Fee calculation edge cases

**Debug checklist**:
- Payment webhook not received? Check `TELEGRAM_WEBHOOK_SECRET` env var and incoming `x-user-id` header
- Conversion stuck? Check `ReconciliationService` for stale states
- Rate unexpected? Verify `RateAggregator` API keys and network calls
- Database errors? Ensure migrations ran: `npm run migrate:status`

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/core/src/services/*.ts` | All business logic—extend these for features |
| `packages/api/src/controllers/*.ts` | HTTP endpoints—keep thin |
| `packages/api/src/middleware/auth.middleware.ts` | API key validation, user context injection |
| `packages/api/src/routes/v1.routes.ts` | Route definitions, middleware binding |
| `database/migrations/*.sql` | Schema definitions, run before adding features |
| `.env` | Environment config: API keys, wallet mnemonic, database URL |
| `docs/ARCHITECTURE.md` | Full system design (read before major changes) |

## Common Tasks

**Adding a new API endpoint**:
1. Create controller method in `packages/api/src/controllers/`
2. Add route to `packages/api/src/routes/v1.routes.ts`
3. Call core service from `packages/core/src/services/`
4. Return standardized response format from controller

**Adding database fields**:
1. Create migration in `database/migrations/` (next number)
2. Add new field to SQL schema
3. Update TypeScript types in `packages/core/src/types/`
4. Update model methods if needed

**Debugging payment flow**:
1. Check webhook received in database: `SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;`
2. Trace status progression through conversions table
3. Check error messages in `error_message` column
4. Use `ReconciliationService.checkConsistency()` for state issues

## Development Timeline (16 weeks)

**Phase 1: Foundation (Weeks 1-4)**
- Week 1: Project setup, npm workspaces, Docker/PostgreSQL, migrations
- Week 2: Database schema, utility functions, seed data
- Week 3: TON Integration (TonBlockchainService)—wallet creation, balance checks, transaction monitoring
- Week 4: Wallet Management (WalletManagerService)—deposit address creation, encryption, balance sync

**Phase 2: Payment Processing (Weeks 5-8)**
- Week 5: Telegram Integration (TelegramService)—webhook handler, Stars payment reception
- Week 6: Payment Flow (PaymentProcessorService)—state machine, error handling
- Week 7: Rate Aggregation (DexAggregator, RateAggregator)—DEX APIs, rate caching
- Week 8: Conversion Logic (ConversionService)—TON/Fiat calculation, fee calculation, rate locking

**Phase 3: API Development (Weeks 9-12)**
- Week 9: Express Server—middleware (auth, rate limit, CORS, error handling)
- Week 10: API Endpoints—payment, wallet, conversion endpoints + documentation
- Week 11: Webhook System—dispatcher, retry logic, verification
- Week 12: SDK Development—client library, type definitions, npm publishing

**Phase 4: Production Ready (Weeks 13-16)**
- Week 13: Background Workers—deposit monitor, rate updater, webhook dispatcher, settlement processor
- Week 14: Testing—unit tests, integration tests, end-to-end testing, security audit
- Week 15: Deployment—Render.com, production database, environment setup, monitoring
- Week 16: Documentation & Launch—integration guide, video tutorials, support system

## Service Implementation Priority

1. **TonBlockchainService** (`packages/core/src/services/ton-blockchain.service.ts`)
   - Wallet creation using TonWeb
   - Deposit monitoring via blockchain polling
   - Balance checking and transaction verification
   - Transaction sending with gas calculations

2. **WalletManagerService** (`packages/core/src/services/wallet-manager.service.ts`)
   - Deposit address generation for users
   - Encryption/decryption of private keys
   - Deposit confirmation monitoring
   - Wallet balance synchronization

3. **TelegramService** (`packages/core/src/services/telegram.service.ts`)
   - Webhook reception from Telegram Bot API
   - Payment payload validation
   - User identification from Telegram ID

4. **RateAggregator** (`packages/core/src/services/rate.aggregator.ts`)
   - Multi-source rate fetching (CoinGecko, DEX pools, CoinMarketCap)
   - Rate caching with TTL
   - Fallback logic when primary source fails

5. **DexAggregator** (`packages/core/src/services/dex-aggregator.service.ts`)
   - Direct DEX API queries (DeDust, Ston.fi)
   - Rate comparison and best price selection
   - Liquidity verification

## Quick Start Commands

```bash
# Initialize workspace
npm install
docker-compose up -d

# Run migrations
npm run migrate

# Start development
npm run dev

# Run tests
npm run test --workspaces

# Format code
npm run lint -- --fix
npm run format

# Build for production
npm run build --workspaces
```

---

*This document is optimized for VS Code Copilot. Reference specific service names and patterns in comments for context-aware suggestions.*
