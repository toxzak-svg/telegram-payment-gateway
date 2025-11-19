# Architecture Guide

System architecture and design decisions for the Telegram Payment Gateway with decentralized P2P liquidity pools.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Database Design](#database-design)
- [Security Architecture](#security-architecture)
- [Scalability](#scalability)

---

## Overview

The Telegram Payment Gateway is a monorepo-based microservices architecture built with TypeScript, designed to process Telegram Stars payments and convert them to TON cryptocurrency through **decentralized P2P liquidity pools** on TON blockchain DEXes (DeDust, Ston.fi).

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Language** | TypeScript 5.x | Type-safe development |
| **API Framework** | Express.js | REST API server |
| **Database** | PostgreSQL 15 | Persistent data storage |
| **Containerization** | Docker + Compose | Development & deployment |
| **Package Manager** | npm workspaces | Monorepo management |

---

## System Architecture

### High-Level Architecture

┌─────────────────┐
│ Telegram Bot │
│ Platform │
└────────┬────────┘
│ Payment Webhooks
▼
┌─────────────────────────────────────────┐
│ API Gateway (Express) │
│ ┌─────────────────────────────────┐ │
│ │ Authentication Middleware │ │
│ │ Rate Limiting Middleware │ │
│ │ Request ID Middleware │ │
│ └─────────────────────────────────┘ │
└────────┬────────────────────────────────┘
│
┌────┴────┐
│ │
▼ ▼
┌────────┐ ┌──────────┐
│Payment │ │Conversion│
│Service │ │ Service │
└───┬────┘ └────┬─────┘
│ │
│ ┌────▼────┐
│ │P2P Pool│
│ │ Service │
│ └────┬────┘
│ │
▼ ▼
┌─────────────────┐
│ PostgreSQL │
│ Database │
└─────────────────┘

text

### Package Structure

│ │ │ ├── controllers/ # Request handlers
│ │ │ ├── routes/ # API routes
│ │ │ ├── db/ # Database connection
│ │ │ └── index.ts # Entry point
│ │ └── scripts/ # Test scripts
│ │
│ ├── core/ # Business logic
│ │ └── src/
│ │ └── services/ # Core services
│ │ ├── payment.service.ts
│ │ ├── conversion.service.ts
│ │ ├── p2p-liquidity.service.ts
│ │ └── dex-aggregator.service.ts
│ │
│ └── shared/ # Shared utilities
│ └── src/
│ └── types/ # Type definitions
│
├── database/
│ └── migrations/ # SQL migrations
│
└── docker-compose.yml # Infrastructure

text

---

## Data Flow

### Payment Processing Flow

User pays with Telegram Stars
│

Telegram sends webhook to /payments/webhook
│

PaymentController.handleTelegramWebhook()
│

PaymentService.processSuccessfulPayment()
│
├─> Validate payment
├─> Store in database
└─> Return confirmation

text

### Conversion Flow

User requests conversion estimate
│

ConversionService.getQuote()
│
├─> Get current exchange rate
├─> Calculate fees
└─> Return quote
│

User locks rate (optional)
│

User creates conversion
│

ConversionService.createConversion()
│
├─> Validate payments
├─> Create conversion record
├─> Update payment status
└─> Start P2P pool conversion
│
├─> P2PLiquidityService.executeSwap()
├─> Query DEX pools for best rate
└─> Update conversion status

text

### Authentication Flow

Request arrives with API key
│

authenticateApiKey middleware
│
├─> Extract API key from:
│ ├─> X-API-Key header
│ ├─> Authorization: Bearer
│ └─> ?api_key query param
│
├─> Validate format (pk_xxx)
├─> Lookup user in database
├─> Check if active
└─> Attach user to req.user
│

Continue to route handler

text

---

## Database Design

### Schema Overview

The database uses PostgreSQL with 8 main tables and supporting indexes/triggers.

#### Core Tables

**users** - Application users and authentication
id (uuid, PK)

api_key (unique)

api_secret

app_name

kyc_status

is_active

created_at, updated_at

text

**payments** - Telegram payment records
id (uuid, PK)

user_id (FK → users)

telegram_payment_id (unique)

stars_amount

status

raw_payload (jsonb)

created_at, confirmed_at

text

**conversions** - Stars → TON conversions
id (uuid, PK)

user_id (FK → users)

payment_ids (uuid[])

source_amount, target_amount

exchange_rate

dex_pool_id

ton_tx_hash

status

created_at, completed_at

text

**settlements** - Fiat settlements
id (uuid, PK)

user_id (FK → users)

conversion_id (FK → conversions)

fiat_amount, fiat_currency

bank_account_id

status

text

#### Supporting Tables

**exchange_rates** - Current and historical rates
**webhook_events** - Outgoing webhook queue
**audit_logs** - System audit trail
**api_keys** - Multi-key support (future)

### Indexes

36 indexes optimized for common queries:

-- User lookups
idx_users_api_key ON users(api_key)
idx_users_is_active ON users(is_active)

-- Payment queries
idx_payments_user_id ON payments(user_id, created_at DESC)
idx_payments_status ON payments(status)
idx_payments_telegram_id ON payments(telegram_payment_id)

-- Conversion queries
idx_conversions_user_id ON conversions(user_id, created_at DESC)
idx_conversions_status ON conversions(status)
idx_conversions_payment_ids ON conversions USING gin(payment_ids)

text

### Relationships

users (1) ──< (N) payments
users (1) ──< (N) conversions
conversions (1) ──< (N) settlements
conversions (N) ──> (N) payments (via payment_ids array)

text

---

## Security Architecture

### Authentication

**API Key Format:**
- Public keys: `pk_` + 48 hex chars
- Secret keys: `sk_` + 64 hex chars
- Generated using crypto.randomBytes()

**Storage:**
- Keys stored in plaintext (no hashing needed for API keys)
- User passwords: Not implemented (API-only service)

**Validation:**
Check format (pk_xxx or sk_xxx)

Query database for matching user

Verify user is active

Attach user to request context

text

### Rate Limiting

**Implementation:** In-memory store (upgrade to Redis for production)

**Limits by Endpoint Type:**
- Registration: 10 req/min
- Standard API: 60 req/min
- Webhooks: 100 req/min
- Conversions: 10 req/min

**Algorithm:** Sliding window with automatic cleanup

### Security Headers

Using Helmet.js for:
- Content Security Policy
- DNS Prefetch Control
- Frame Guard
- HSTS
- IE No Open
- X-XSS Protection

### CORS

Enabled with default config. Configure origins in production:

app.use(cors({
origin: process.env.ALLOWED_ORIGINS?.split(','),
credentials: true
}));

text

---

## Scalability

### Horizontal Scaling

**Current State:** Single-instance
**Scale-out Strategy:**

1. **API Layer:**
   - Stateless design (ready for load balancing)
   - Add nginx/HAProxy in front
   - Scale API containers with Docker Swarm/K8s

2. **Database:**
   - Current: Single PostgreSQL instance
   - Scale: Read replicas for analytics
   - Future: Citus for sharding

3. **Rate Limiting:**
   - Migrate from in-memory to Redis
   - Shared state across API instances

### Vertical Scaling

**Database Optimization:**
- 36 indexes for fast queries
- Connection pooling (20 connections)
- Prepared statements
- JSONB for flexible data

**API Performance:**
- Compression enabled
- Keep-alive connections
- Streaming for large responses

### Bottlenecks & Solutions

| Component | Current Limit | Solution |
|-----------|--------------|----------|
| API instances | 1 | Load balancer + multiple instances |
| Database connections | 20 | Increase pool size, add replicas |
| Rate limiting | In-memory | Migrate to Redis |
| DEX APIs | Rate limiting | Implement caching & fallback pools |

---

## Monitoring & Observability

### Logging

**Current Implementation:**
console.log() with structured data

text

**Production Recommendations:**
- Winston or Pino for structured logging
- Log aggregation (ELK stack, Datadog)
- Error tracking (Sentry)

### Metrics to Track

**Application:**
- Request rate (per endpoint)
- Response times (p50, p95, p99)
- Error rates
- Authentication failures

**Business:**
- Payments processed
- Conversion success rate
- Total volume (Stars, TON)
- User growth

**Infrastructure:**
- CPU/Memory usage
- Database connections
- Query performance
- Disk usage

### Health Checks

**Current:**
GET /health
GET /api/v1/health (planned)

text

**Production:**
- Database connectivity check
- External service availability
- Disk space check
- Memory usage check

---

## Deployment Architecture

### Development

Local Machine
├── Docker Compose
│ ├── PostgreSQL container
│ └── (Future: Redis, etc.)
└── Node.js (host machine)
└── API (ts-node-dev)

text

### Production (Recommended)

Cloud Platform (Railway/Render/AWS)
├── Load Balancer
├── API Instances (N)
│ └── Docker containers
├── PostgreSQL (managed)
└── Redis (managed)

text

### CI/CD Pipeline

**Recommended Flow:**
Push to GitHub
│

GitHub Actions runs:
├─> Lint
├─> Type check
├─> Run tests
└─> Build Docker image
│

Deploy to staging
│

Run integration tests
│

Deploy to production

text

---

## Future Enhancements

### Phase 2 Features

1. **Webhook System**
   - Queue-based webhook delivery
   - Automatic retries
   - Delivery tracking

2. **Advanced Rate Limiting**
   - Per-endpoint limits
   - User-tier based limits
   - Burst allowance

3. **Caching Layer**
   - Redis for rate data
   - Exchange rate caching
   - User profile caching

### Phase 3 Features

1. **Multi-region Deployment**
   - Geographic load balancing
   - Regional databases
   - CDN for static assets

2. **Analytics Dashboard**
   - Real-time metrics
   - Business intelligence
   - User insights

3. **Advanced Security**
   - API key rotation
   - IP whitelisting
   - Anomaly detection

---

## Design Decisions

### Why PostgreSQL?

- ✅ ACID compliance for financial data
- ✅ JSONB for flexible payment data
- ✅ Array types for payment_ids
- ✅ Rich indexing options
- ✅ Strong ecosystem

### Why Monorepo?

- ✅ Shared types across packages
- ✅ Atomic commits across services
- ✅ Simplified dependency management
- ✅ Easier refactoring

### Why Express?

- ✅ Battle-tested and stable
- ✅ Rich middleware ecosystem
- ✅ Simple and flexible
- ✅ Great TypeScript support

### Why TypeScript?

- ✅ Type safety for financial logic
- ✅ Better IDE support
- ✅ Easier refactoring
- ✅ Self-documenting code

---

## Conclusion

This architecture provides a solid foundation for a production payment gateway with clear paths for scaling and enhancement.