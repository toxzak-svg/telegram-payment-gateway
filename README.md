# Telegram Payment Gateway

> **Decentralized P2P Payment Processing Gateway** — Convert Telegram Stars to TON cryptocurrency through P2P liquidity pools and DEX integration. No centralized exchanges, no KYC, truly permissionless.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
[![TON](https://img.shields.io/badge/TON-Blockchain-0088cc)](https://ton.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

**Status**: 🟢 Production-Ready MVP (95% Complete) | **Version**: 2.0.0

## 🌟 Overview

A production-ready monorepo payment gateway enabling developers to accept Telegram Stars payments and convert them to TON cryptocurrency through **decentralized P2P liquidity pools** (DeDust, Ston.fi). Built with TypeScript, Express.js, PostgreSQL, and TON SDK for maximum reliability.

**Latest Updates** (November 2025):

- ✅ All Fragment.com API references removed - fully decentralized P2P/DEX architecture
- ✅ Security incident resolved - credentials rotated, Git history cleaned
- ✅ Dashboard fully functional with real-time API integration
- ✅ Automated fee collection system with configurable thresholds
- ✅ Render.com deployment configured with environment variables secured

### Why This Gateway?

- 🔓 **No KYC Required** — Direct blockchain integration bypasses centralized exchanges
- ⚡ **Instant Settlements** — P2P liquidity pools enable conversions in 1-2 minutes
- 💰 **Lower Fees** — Decentralized architecture eliminates intermediary costs (0.25-0.3% DEX fees only)
- 🔐 **Non-Custodial** — Users maintain control through direct wallet transfers
- 🌐 **Truly Decentralized** — Smart contract-based liquidity on TON blockchain (DeDust V2, Ston.fi Router)
- 🛠️ **Developer-Friendly** — RESTful API, TypeScript SDK, React dashboard, comprehensive docs

### Production Status

**✅ Completed** (95%):
- ✅ Core payment processing (Telegram Stars webhook integration)
- ✅ TON blockchain integration (wallet management, deposit monitoring)
- ✅ DEX aggregation (DeDust, Ston.fi rate comparison)
- ✅ P2P liquidity routing (intelligent pool selection)
- ✅ REST API (28 endpoints, 6 controllers)
- ✅ React dashboard (authentication, real-time stats, transaction management)
- ✅ Database schema (18 tables, 9 migrations)
- ✅ Fee calculation system (4-component fee structure)

**🔴 Critical TODOs** (5% remaining):

- Blockchain transaction polling

See [PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) for complete roadmap and 6-week completion timeline.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose  
- PostgreSQL 16+
- TON wallet with mnemonic

### Installation

```bash
# Clone repository
git clone https://github.com/toxzak-svg/telegram-payment-gateway.git
cd telegram-payment-gateway

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start infrastructure
docker-compose up -d

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

API will be available at `http://localhost:3000`

### Fee Collection Setup

1. **Set the platform TON wallet** (used to sweep collected fees):

   ```bash
   npm run wallet:update EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   Replace the placeholder with your custodial TON address (must start with `EQ` or `UQ`).

2. **Launch the automated fee collector** once you deploy or have test payments flowing:

   ```bash
   npm run worker:fees
   ```

   This worker checks pending platform fees every hour and transfers the balance to the wallet you configured above. The worker requires `DATABASE_URL`, `TON_API_URL`, `TON_API_KEY`, and `TON_WALLET_MNEMONIC` to be present in `.env`.

3. **Monitor revenue** using the admin endpoints:
   - `GET /api/v1/admin/stats` – dashboard KPIs (revenue, merchants, success rate)
   - `GET /api/v1/admin/revenue/summary?startDate=...&endDate=...`
   - `GET /api/v1/admin/transactions/summary?startDate=...&endDate=...`

---

## 📋 Table of Contents

1. [Key Features](#key-features)
2. [Architecture](#architecture)
3. [Payment Flow](#payment-flow)
4. [Project Structure](#project-structure)
5. [API Overview](#api-overview)
6. [Development Guide](#development-guide)
7. [Deployment](#deployment)
8. [Contributing](#contributing)

---

## ✨ Key Features

### 💰 Payment Processing

- **Telegram Stars Integration** — Seamless webhook handling for Telegram payments
- **Real-time Payment Tracking** — Monitor payment status with detailed history
- **Automatic Verification** — Built-in payment validation and fraud detection
- **Batch Processing** — Handle multiple payments efficiently

### 🔄 P2P Liquidity Pools

- **Decentralized Exchange** — Integrated with TON blockchain DEXes (DeDust, Ston.fi)
- **Smart Order Routing** — Automatically finds best liquidity pool rates
- **Rate Lock Mechanism** — Optional 5-minute rate locks for predictable conversions
- **Multi-Currency Support** — Convert to TON, USD, EUR, GBP equivalents
- **Instant Swaps** — Process conversions in 1-2 minutes through P2P pools

### 🛡️ Security & Authentication

- **API Key Authentication** — Secure `pk_` prefix public keys
- **Rate Limiting** — Configurable per-endpoint throttling (10-100 req/min)
- **Webhook Signatures** — HMAC verification for all callbacks
- **Request Tracing** — Unique request IDs for debugging
- **Comprehensive Audit Logs** — Track all system actions

### 🧩 Developer Experience

- **TypeScript SDK** — Fully typed client library with autocomplete
- **RESTful API** — Clean, predictable endpoints following REST principles
- **Docker Support** — One-command development environment
- **OpenAPI Docs** — Auto-generated API documentation
- **Code Examples** — Sample implementations in multiple languages

### 💹 Monetization & Analytics

- **Automated Fee Sweeps** — Background worker aggregates platform fees and sends TON to your treasury wallet once thresholds are hit
- **Configurable Fee Structure** — Tune platform, DEX, and network percentages directly via the admin config endpoint
- **Revenue Dashboards** — `/admin/stats` and summary APIs power the React dashboard with real-time revenue, merchant, and success KPIs
- **Collection History** — Fee collection records tracked in `fee_collections` for reconciliation and payouts

---

## 🏗️ Architecture

### System Design

```text
┌─────────────────────┌
│   Telegram Bot      │
│   (User Payment)    │
└──────────┬──────────┘
           │ Stars Payment Webhook
           ▼
┌──────────────────────────────────────┐
│   Payment Gateway API                │
│  ┌────────────────────────────────┐  │
│  │  Payment Webhook Handler       │  │
│  └──────────┬─────────────────────┘  │
│             ▼                         │
│  ┌────────────────────────────────┐  │
│  │  Payment Processing Service    │  │
│  │  - Validate Stars payment      │  │
│  │  - Create payment record       │  │
│  │  - Generate conversion quote   │  │
│  └──────────┬─────────────────────┘  │
└─────────────┼────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│   P2P Liquidity Pools (TON DEXes)    │
│  ┌────────────────────────────────┐  │
│  │  DeDust Protocol               │  │
│  │  Ston.fi Exchange              │  │
│  │  Other TON DEXes               │  │
│  └──────────┬─────────────────────┘  │
└─────────────┼────────────────────────┘
              │ Best Rate Selection
              ▼
┌──────────────────────────────────────┐
│   TON Blockchain Integration         │
│  ┌────────────────────────────────┐  │
│  │  Wallet Manager Service        │  │
│  │  - Create custody wallets      │  │
│  │  - Monitor deposits            │  │
│  │  - Verify confirmations        │  │
│  │  - Execute swaps               │  │
│  └──────────┬─────────────────────┘  │
└─────────────┼────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│   Settlement & Webhook Dispatch      │
│  - Update conversion status          │
│  - Send developer webhooks           │
│  - Record audit logs                 │
└──────────────────────────────────────┘
```

### Technology Stack

| Layer              | Technology       | Purpose                          |
|--------------------|------------------|----------------------------------|
| **Language**       | TypeScript 5.2   | Type-safe development            |
| **Runtime**        | Node.js 20+      | JavaScript execution             |
| **API Framework**  | Express 4.x      | REST API server                  |
| **Database**       | PostgreSQL 16    | Persistent data storage          |
| **Blockchain**     | TonWeb, @ton/ton | TON blockchain interaction       |
| **Containerization** | Docker Compose | Development & deployment env    |
| **Package Manager**| npm workspaces   | Monorepo management              |

### Package Structure

```
telegram-payment-gateway/
├── packages/
│   ├── core/          # Business logic & services
│   ├── api/           # REST API server
│   ├── sdk/           # Client SDK for developers
│   ├── worker/        # Background jobs & queue processing
│   └── dashboard/     # Optional admin dashboard
├── database/          # Migrations & seeds
└── docker/            # Docker configurations
```

---

## 🔄 Payment Flow

### User Journey

```text
1. User Pays with Telegram Stars
   ↓
2. Telegram sends webhook to gateway
   ↓
3. Gateway validates & records payment
   ↓
4. System queries P2P liquidity pools for best rate
   ↓
5. User optionally locks exchange rate (5 min)
   ↓
6. Gateway creates custody wallet & deposit address
   ↓
7. User manually converts Stars → TON in Telegram
   ↓
8. User sends TON to provided deposit address
   ↓
9. Gateway monitors blockchain for deposit
   ↓
10. After 10+ confirmations, TON is confirmed
    ↓
11. Gateway executes swap through best DEX pool
    ↓
12. Conversion completes, developer webhook sent
    ↓
13. Settlement processed (fiat or crypto)
```

### Status State Machine

**Payment States:**

```text
pending → received → awaiting_ton → ton_pending → 
ton_confirmed → converting → settled → completed
```

**Conversion States:**

```text
pending → rate_locked → awaiting_ton → ton_received → 
converting_fiat → completed
```

**Deposit States:**

```text
pending → awaiting_confirmation → confirmed
```

---

## 📁 Project Structure

```
telegram-payment-gateway/
├── packages/
│   ├── core/                    # @tg-payment/core
│   │   └── src/
│   │       ├── services/        # Business logic
│   │       │   ├── payment-processor.service.ts
│   │       │   ├── ton-blockchain.service.ts
│   │       │   ├── wallet-manager.service.ts
│   │       │   ├── dex-aggregator.service.ts
│   │       │   ├── p2p-liquidity.service.ts
│   │       │   ├── rate-aggregator.service.ts
│   │       │   └── settlement.service.ts
│   │       ├── models/          # Database models
│   │       │   ├── payment.model.ts
│   │       │   ├── conversion.model.ts
│   │       │   ├── wallet.model.ts
│   │       │   └── deposit.model.ts
│   │       └── types/           # TypeScript types
│   │
│   ├── api/                     # @tg-payment/api
│   │   └── src/
│   │       ├── controllers/     # HTTP request handlers
│   │       ├── middleware/      # Auth, rate limit, etc.
│   │       ├── routes/          # API endpoints
│   │       └── server.ts        # Express app
│   │
│   ├── sdk/                     # @tg-payment/sdk
│   │   └── src/
│   │       ├── client.ts        # SDK client
│   │       └── types.ts         # SDK types
│   │
│   └── worker/                  # @tg-payment/worker
│       └── src/
│           └── jobs/            # Background jobs
│               ├── deposit-monitor.job.ts
│               ├── rate-updater.job.ts
│               └── webhook-dispatcher.job.ts
│
├── database/
│   ├── migrations/              # SQL migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_platform_fees.sql
│   │   ├── 003_reconciliation_webhooks.sql
│   │   ├── 004_missing_columns.sql
│   │   ├── 005_fee_collections.sql
│   │   ├── 006_withdrawals_table.sql
│   │   └── 007_stars_p2p_orders.sql
│   └── seeds/                   # Seed data
│
├── docker/
│   ├── Dockerfile.api
│   └── Dockerfile.worker
│
├── docs/                        # Documentation
├── docker-compose.yml           # Local development
├── package.json                 # Workspace config
└── tsconfig.json                # TypeScript config
```

---

## 🔌 API Overview

### Authentication

All endpoints require API key authentication:

```bash
# Header (recommended)
curl -H "X-API-Key: pk_your_api_key" https://api.gateway.com/v1/payments

# Bearer token
curl -H "Authorization: Bearer pk_your_api_key" https://api.gateway.com/v1/payments
```

### Core Endpoints

#### User Management

```http
POST   /v1/users/register        # Register & get API keys
GET    /v1/users/me              # Get user profile
PUT    /v1/users/settings        # Update settings
```

#### Payments

```http
POST   /v1/payments/webhook      # Telegram payment webhook (no auth)
GET    /v1/payments              # List payments
GET    /v1/payments/:id          # Get payment details
```

#### Conversions

```http
POST   /v1/conversions/quote     # Get conversion quote from P2P pools
POST   /v1/conversions           # Create conversion
GET    /v1/conversions/:id       # Get conversion status
```

#### Deposits

```http
POST   /v1/deposits              # Create deposit address
GET    /v1/deposits/:id          # Get deposit status
```

#### Wallets

```http
GET    /v1/wallets               # Get wallet balances
GET    /v1/wallets/:id           # Get wallet details
POST   /v1/wallets/withdraw      # Withdraw TON
```

### Response Format

**Success Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "amount": 1000,
    "status": "completed"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Wallet balance too low"
  }
}
```

---

## 🛠️ Development Guide

### Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/tg_payment_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Server
PORT=3000
NODE_ENV=development

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# TON Blockchain (Direct Integration)
TON_WALLET_MNEMONIC=your 24 word mnemonic phrase
TON_API_KEY=your_tonx_key
TON_API_URL=https://toncenter.com/api/v2/jsonRPC
TON_MAINNET=true
TON_WORKCHAIN=0

# DEX Integration (P2P Liquidity)
DEDUST_API_URL=https://api.dedust.io
STONFI_API_URL=https://api.ston.fi

# Exchange Rates
COINGECKO_API_KEY=optional
COINMARKETCAP_API_KEY=optional

# Security
API_SECRET_KEY=random_secret_key
JWT_SECRET=jwt_secret_key
WALLET_ENCRYPTION_KEY=256_bit_hex_key

# Conversion Settings
MIN_CONVERSION_STARS=100
RATE_LOCK_DURATION_SECONDS=300
MAX_PENDING_CONVERSIONS=10
```

### Development Commands

```bash
# Install dependencies
npm install

# Start database
docker-compose up -d postgres

# Run migrations
npm run migrate

# Check migration status
npm run migrate:status

# Start API in dev mode (with hot reload)
npm run dev --workspace=@tg-payment/api

# Start all packages
npm run dev

# Run tests
npm run test

# Lint & format
npm run lint
npm run format

# Build for production
npm run build
```

### Testing

```bash
# Run all tests
npm run test --workspaces

# Run specific package tests
npm run test --workspace=@tg-payment/core

# Test payment flow
node packages/api/scripts/test-payment.js

# Test conversion flow
node packages/api/scripts/test-conversion.js

# Test authentication
node packages/api/scripts/test-auth.js
```

#### DEX Simulation Mode

Integration tests that hit DeDust/Ston.fi now default to a deterministic simulator so they can run inside CI without public DEX access. To force real network calls, disable the simulator and opt in explicitly:

```bash
DEX_SIMULATION_MODE=false RUN_DEX_INTEGRATION_TESTS=true npm run test --workspace=@tg-payment/core
```

With `DEX_SIMULATION_MODE=true` (default for tests) the swap suites still execute but rely on mocked rates, ensuring coverage without hitting centralized exchanges or TON RPCs.

### Background Workers

Deposit monitoring and settlement processing run in a lightweight worker backed by the new `manual_deposits` table. Launch it alongside the API once your `.env` contains the TON mnemonic and webhook secret:

```bash
npm run worker:monitor --workspace=@tg-payment/core
```

The worker boots the TON deposit monitor plus the settlement processor, emits `deposit.confirmed` / `settlement.completed` webhooks, and can be scaled horizontally because it relies on database row locks instead of in-memory state.

> ℹ️ Need the full flow? See `docs/SETTLEMENT_FLOW.md` for the end-to-end deposit → settlement diagram, required environment variables, and the exact Jest suites we run to validate the worker stack.

### Database Management

```bash
# Run migrations
npm run migrate

# Rollback last migration
npm run migrate:down

# Reset database (careful!)
npm run migrate:reset

# Check migration status
npm run migrate:status
```

---

## 🚀 Deployment

### Docker Deployment

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Production Environment

**Recommended Hosting:**

- **API**: Railway, Render, or AWS ECS
- **Database**: Managed PostgreSQL (AWS RDS, Railway, Supabase)
- **Redis**: Upstash or AWS ElastiCache (for job queues)

**Environment Checklist:**

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `WALLET_ENCRYPTION_KEY` (32+ bytes)
- [ ] Enable database SSL (`DATABASE_SSL=true`)
- [ ] Configure webhook URL for Telegram
- [ ] Set up monitoring (Sentry, Datadog)
- [ ] Enable rate limiting on reverse proxy
- [ ] Configure CORS for allowed origins
- [ ] Set up automated backups for PostgreSQL

### Health Checks

```bash
# API health
curl https://your-domain.com/health

# Database connectivity
curl https://your-domain.com/api/v1/health
```

---

## 🔐 Security Best Practices

### API Security

- Use HTTPS in production (TLS 1.3)
- Rotate API keys regularly
- Implement IP whitelisting for sensitive endpoints
- Enable rate limiting per user and IP
- Validate all input data
- Use prepared statements for SQL queries

### Wallet Security

- Encrypt private keys with AES-256
- Store encryption keys in secure vault (AWS KMS, HashiCorp Vault)
- Use separate hot/cold wallets
- Implement multi-signature for large withdrawals
- Monitor for unusual activity

### Webhook Security

- Verify HMAC signatures
- Implement replay attack prevention
- Use unique webhook secrets per user
- Retry failed webhooks with exponential backoff

---

## 📊 Monitoring & Observability

### Key Metrics

**Business Metrics:**

- Total payments processed
- Conversion success rate
- Average processing time
- P2P liquidity pool utilization
- Total volume (Stars, TON, Fiat)

**Technical Metrics:**

- API response times (p50, p95, p99)
- Error rates by endpoint
- Database connection pool usage
- Blockchain confirmation times
- Webhook delivery success rate

### Logging

Structured JSON logging with Winston:

```typescript
logger.info('Payment processed', {
  paymentId: 'uuid',
  amount: 1000,
  currency: 'STARS',
  status: 'completed'
});
```

### Error Tracking

Integrate Sentry for error monitoring:

```typescript
Sentry.captureException(error, {
  tags: { service: 'payment-processor' },
  extra: { paymentId, userId }
});
```

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes with clear commits**: `git commit -m 'feat: add P2P pool aggregation'`
4. **Write tests** for new functionality
5. **Ensure linting passes**: `npm run lint`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open Pull Request** with detailed description

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add new feature
fix: bug fix
docs: documentation changes
test: add tests
refactor: code refactoring
chore: maintenance tasks
```

### Using GitHub Copilot

This repository is configured for GitHub Copilot coding agent! See [Copilot Setup Guide](./docs/COPILOT_SETUP.md) for:

- Custom instructions and best practices
- Pre-configured development environment
- Task examples and workflow guidance
- Troubleshooting tips

Copilot can help with bug fixes, feature additions, tests, and documentation. Simply assign it an issue or prompt it with a task.

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

---

## 🙏 Acknowledgments

- **TON Blockchain** — For providing decentralized infrastructure
- **DeDust & Ston.fi** — P2P DEX protocols powering liquidity pools
- **Telegram** — For Stars payment system
- **TonWeb & @ton/ton** — Blockchain SDK libraries

---

## 📞 Support

- **Documentation**: [/docs](/docs)
- **GitHub Copilot Setup**: [Copilot Configuration Guide](./docs/COPILOT_SETUP.md)
- **Issues**: [GitHub Issues](https://github.com/toxzak-svg/telegram-payment-gateway/issues)
- **Discussions**: [GitHub Discussions](https://github.com/toxzak-svg/telegram-payment-gateway/discussions)

---

## 🗺️ Roadmap

### Phase 1: Core Infrastructure ✅

- [x] Database schema & migrations
- [x] TON blockchain integration
- [x] Wallet management system
- [x] Basic API endpoints

### Phase 2: P2P Liquidity ✅

- [x] DEX aggregator service
- [x] DeDust protocol integration
- [x] Ston.fi integration
- [x] Smart order routing
- [x] Multi-pool liquidity discovery

### Phase 3: Advanced Features

- [ ] Cross-chain bridges (ETH, BSC)
- [x] Limit orders for conversions
- [ ] Advanced analytics dashboard
- [ ] Multi-signature wallets
- [ ] Automated market making

### Phase 4: Ecosystem

- [ ] Developer marketplace
- [ ] Liquidity provider incentives
- [ ] Governance token (DAO)
- [ ] Mobile SDK (React Native)

---

**Built with ❤️ for the decentralized future**
┌─────────────────┐
