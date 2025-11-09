# Telegram Stars Payment Gateway

A unified payment processing platform for Telegram developers that simplifies conversions from Telegram Stars → TON → Fiat currencies.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)

### Local Setup

1. **Clone and install**
\`\`\`bash
git clone <repo>
cd telegram-payment-gateway
npm install
\`\`\`

2. **Environment configuration**
\`\`\`bash
cp .env.example .env
# Edit .env with your API keys
\`\`\`

3. **Start with Docker**
\`\`\`bash
npm run docker:up
\`\`\`

4. **Run migrations**
\`\`\`bash
npm run db:migrate
npm run db:seed
\`\`\`

5. **Start development**
\`\`\`bash
npm run dev
\`\`\`

Visit `http://localhost:3000` to see the API running.

## Architecture

- **packages/core**: Business logic, services, and models
- **packages/api**: Express.js server and REST endpoints
- **packages/sdk**: Client SDK for developers
- **database**: PostgreSQL schemas and migrations
- **docker**: Container configuration

## Testing

\`\`\`bash
npm run test
npm run test:coverage
\`\`\`

## Development Status

- ✅ Week 1: Foundation (database, config, types)
- ⏳ Week 2-4: Core services
- ⏳ Week 5-8: API & SDK
- ⏳ Week 9-12: Advanced features
- ⏳ Week 13-16: Dashboard & deployment

## License

MIT
