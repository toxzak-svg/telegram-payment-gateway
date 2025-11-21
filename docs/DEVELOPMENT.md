# Development Guide

Complete guide for developers working on the Telegram Payment Gateway.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Testing](#testing)
- [Debugging](#debugging)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

Make sure you have these installed:

Check versions
node --version # Should be 18+
npm --version # Should be 9+
docker --version
docker-compose --version

text

### Initial Setup

1. Clone repository
git clone https://github.com/yourusername/telegram-payment-gateway.git
cd telegram-payment-gateway

2. Install dependencies
npm install

3. Create .env file
cp .env.example .env

Edit .env with your credentials
4. Start database
docker-compose up -d postgres

5. Verify database is ready
docker logs tg_payment_postgres

6. Start development server
npm run dev --workspace=@tg-payment/api

text

### Environment Setup

Create `.env` in project root:

Database
DATABASE_URL=postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev
POSTGRES_USER=tg_user
POSTGRES_PASSWORD=tg_pass
POSTGRES_DB=tg_payment_dev

API
PORT=3000
NODE_ENV=development

Telegram (optional for development)
TELEGRAM_BOT_TOKEN=your_bot_token

TON (optional for development)
TON_WALLET_ADDRESS=EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2
DEDUST_API_URL=https://api.dedust.io
STONFI_API_URL=https://api.ston.fi

Security
WEBHOOK_SECRET=dev_secret_change_in_production

text

---

## Development Workflow

### Starting Development

Terminal 1: Start database
docker-compose up postgres

Terminal 2: Start API with hot reload
npm run dev --workspace=@tg-payment/api

Terminal 3: Run tests (optional)
npm test

Access API at http://localhost:3000
text

### Making Changes

1. Create feature branch
git checkout -b feature/your-feature-name

2. Make changes
- Edit files in packages/api or packages/core
- API auto-reloads on save
3. Test changes
node packages/api/scripts/test-payment.js

4. Commit
git add .
git commit -m "feat: description of changes"

5. Push
git push origin feature/your-feature-name

text

### NPM Scripts

Development
npm run dev # Start all packages in dev mode
npm run dev --workspace=@tg-payment/api # Start API only

Building
npm run build # Build all packages
npm run build --workspace=@tg-payment/api

Testing
npm test # Run all tests (includes DB setup)
npm run test:prepare # Reset test database
npm run test:run # Run tests without setup
npm run test:api # Test API only

Linting
npm run lint # Lint all packages
npm run lint:fix # Auto-fix linting issues

Database
npm run db:migrate # Run migrations
npm run db:seed # Seed database
npm run db:reset # Reset database

text

---

## Code Structure

### Package Organization

packages/
├── api/ # REST API server
│ ├── src/
│ │ ├── controllers/ # Route handlers
│ │ │ ├── user.controller.ts
│ │ │ ├── payment.controller.ts
│ │ │ └── conversion.controller.ts
│ │ │
│ │ ├── middleware/ # Express middleware
│ │ │ ├── auth.middleware.ts
│ │ │ ├── rateLimit.middleware.ts
│ │ │ └── requestId.middleware.ts
│ │ │
│ │ ├── routes/ # Route definitions
│ │ │ └── v1.routes.ts
│ │ │
│ │ ├── db/ # Database connection
│ │ │ └── connection.ts
│ │ │
│ │ └── index.ts # Entry point
│ │
│ └── scripts/ # Test scripts
│ ├── test-payment.js
│ ├── test-conversion.js
│ └── test-auth.js
│
├── core/ # Business logic
│ └── src/
│ └── services/ # Core services
│ ├── payment.service.ts
│ ├── conversion.service.ts
│ └── fragment.service.ts
│
└── shared/ # Shared code
└── src/
└── types/ # TypeScript types

text

### Adding a New Endpoint

**1. Define route in `v1.routes.ts`:**

import { MyController } from '../controllers/my.controller';

router.get('/my-endpoint',
authenticateApiKey,
standardLimit,
MyController.myMethod
);

text

**2. Create controller in `controllers/my.controller.ts`:**

import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';

export class MyController {
static async myMethod(req: Request, res: Response) {
const requestId = uuid();
const userId = (req as any).user?.id;

text
try {
  // Your logic here
  
  return res.status(200).json({
    success: true,
    data: {},
    requestId,
  });
} catch (error) {
  console.error('Error:', error);
  return res.status(500).json({
    success: false,
    error: { code: 'ERROR_CODE', message: 'Error message' },
    requestId,
  });
}
}
}

text

**3. Add service logic in `core/services/`:**

export class MyService {
private pool: Pool;

constructor(pool: Pool) {
this.pool = pool;
}

async doSomething(): Promise<any> {
const result = await this.pool.query('SELECT * FROM table');
return result.rows;
}
}

text

**4. Write tests:**

// packages/api/scripts/test-my-feature.js
const axios = require('axios');

async function testMyFeature() {
const response = await axios.get('http://localhost:3000/api/v1/my-endpoint', {
headers: { 'X-API-Key': 'pk_test_key' }
});

console.log('✅ Test passed:', response.data);
}

testMyFeature();

text

### Database Queries

**Using raw SQL:**

// Good - parameterized queries
const result = await pool.query(
'SELECT * FROM users WHERE id = $1',
[userId]
);

// Bad - vulnerable to SQL injection
const result = await pool.query(
SELECT * FROM users WHERE id = '${userId}'
);

text

**Transactions:**

const client = await pool.connect();

try {
await client.query('BEGIN');

await client.query('UPDATE table1 SET ...');
await client.query('INSERT INTO table2 ...');

await client.query('COMMIT');
} catch (error) {
await client.query('ROLLBACK');
throw error;
} finally {
client.release();
}

text

---

## Testing

### Running Tests

All tests
npm test

Specific test suites
node packages/api/scripts/test-payment.js
node packages/api/scripts/test-conversion.js
node packages/api/scripts/test-auth.js

With debugging
NODE_ENV=test DEBUG=* npm test

text

### Writing Integration Tests

const axios = require('axios');
const API_URL = 'http://localhost:3000/api/v1';

async function testMyFeature() {
console.log('🧪 Testing My Feature\n');

try {
// 1. Setup
const user = await createTestUser();

text
// 2. Execute
const response = await axios.post(`${API_URL}/endpoint`, {
  data: 'test'
}, {
  headers: { 'X-API-Key': user.apiKey }
});

// 3. Verify
console.log('✅ Test passed:', response.data);
} catch (error) {
console.error('❌ Test failed:', error.response?.data);
}
}

text

### Test Data

Create test user
curl -X POST http://localhost:3000/api/v1/users/register
-H "Content-Type: application/json"
-d '{"appName":"Test App"}'

Use returned API key for subsequent tests
export TEST_API_KEY="pk_xxx"

text

---

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

{
"version": "0.2.0",
"configurations": [
{
"type": "node",
"request": "launch",
"name": "Debug API",
"runtimeExecutable": "npm",
"runtimeArgs": ["run", "dev", "--workspace=@tg-payment/api"],
"skipFiles": ["<node_internals>/**"],
"envFile": "${workspaceFolder}/.env"
}
]
}

text

### Logging

**Current implementation:**
console.log('✅ Success:', data);
console.error('❌ Error:', error);

text

**Add contextual logging:**
console.log('[PaymentService] Processing payment', {
paymentId,
userId,
amount,
timestamp: new Date().toISOString()
});

text

### Database Debugging

Connect to database
docker exec -it tg_payment_postgres psql -U tg_user -d tg_payment_dev

Useful queries
SELECT * FROM users LIMIT 5;
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
SELECT * FROM conversions WHERE status = 'pending';

Check connection count
SELECT count(*) FROM pg_stat_activity;

View slow queries
SELECT query, calls, total_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

text

### Network Debugging

Test API directly
curl http://localhost:3000/health

Test with authentication
curl -H "X-API-Key: pk_xxx" http://localhost:3000/api/v1/users/me

View request details
curl -v http://localhost:3000/api/v1/payments/stats

Test rate limiting
for i in {1..15}; do
curl -H "X-API-Key: pk_xxx" http://localhost:3000/api/v1/users/me
done

text

---

## Best Practices

### TypeScript

// ✅ Good - explicit types
function processPayment(amount: number, currency: string): Promise<Payment> {
// ...
}

// ❌ Bad - implicit any
function processPayment(amount, currency) {
// ...
}

// ✅ Good - use interfaces
interface PaymentData {
amount: number;
currency: string;
userId: string;
}

// ✅ Good - use type guards
if (typeof amount === 'number' && amount > 0) {
// safe to use amount
}

text

### Error Handling

// ✅ Good - comprehensive error handling
try {
const result = await doSomething();
return res.status(200).json({ success: true, data: result });
} catch (error) {
console.error('Operation failed:', error);

if (error instanceof ValidationError) {
return res.status(400).json({
success: false,
error: { code: 'VALIDATION_ERROR', message: error.message }
});
}

return res.status(500).json({
success: false,
error: { code: 'SERVER_ERROR', message: 'Operation failed' }
});
}

// ❌ Bad - swallowing errors
try {
await doSomething();
} catch (error) {
// Silent failure
}

text

### Database Queries

// ✅ Good - use connection pool
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// ✅ Good - release connections
const client = await pool.connect();
try {
await client.query(...);
} finally {
client.release(); // Always release!
}

// ❌ Bad - creating new connections
const { Client } = require('pg');
const client = new Client({ ... });
await client.connect(); // Don't do this repeatedly

text

### API Responses

// ✅ Good - consistent response format
return res.status(200).json({
success: true,
data: result,
requestId: uuid(),
timestamp: new Date().toISOString()
});

// ✅ Good - include request ID for debugging
console.log('Processing request', { requestId });

// ❌ Bad - inconsistent responses
return res.json({ result }); // Missing success flag
return res.send('OK'); // Not JSON

text

---

## Troubleshooting

### Common Issues

**1. Database connection refused**

Check if postgres is running
docker ps | grep postgres

If not, start it
docker-compose up -d postgres

Check logs
docker logs tg_payment_postgres

Verify connection
docker exec -it tg_payment_postgres psql -U tg_user -d tg_payment_dev

text

**2. Port already in use**

Find process using port 3000
lsof -i :3000 # Mac/Linux
netstat -ano | findstr :3000 # Windows

Kill process
kill -9 <PID> # Mac/Linux
taskkill /PID <PID> /F # Windows

Or change port in .env
PORT=3001

text

**3. API not reloading**

Restart with clean cache
npm run dev --workspace=@tg-payment/api -- --no-cache

Or restart manually
Ctrl+C then restart
text

**4. TypeScript errors**

Rebuild packages
npm run build

Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

text

**5. Database migration errors**

Check current schema
docker exec -it tg_payment_postgres psql -U tg_user -d tg_payment_dev -c "\dt"

Drop and recreate database
docker-compose down -v
docker-compose up -d postgres

Wait for init, then check logs
sleep 10
docker logs tg_payment_postgres

text

### Getting Help

1. Check logs: `docker logs tg_payment_postgres`
2. Test database: `docker exec -it tg_payment_postgres psql -U tg_user`
3. Review recent commits: `git log --oneline -10`
4. Check GitHub issues
5. Ask in project chat/Discord

---

## Performance Tips

### Database

// ✅ Use indexes
CREATE INDEX idx_payments_user_created ON payments(user_id, created_at DESC);

// ✅ Batch queries
const payments = await pool.query(
'SELECT * FROM payments WHERE id = ANY($1)',
[[id1, id2, id3]]
);

// ❌ Avoid N+1 queries
for (const user of users) {
await pool.query('SELECT * FROM payments WHERE user_id = $1', [user.id]);
}

text

### API

// ✅ Use connection pooling (already configured)
export const pool = new Pool({ max: 20 });

// ✅ Enable compression (already enabled)
app.use(compression());

// ✅ Implement caching
const cached = cache.get(key);
if (cached) return cached;

text

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Code style guide
- Pull request process
- Review checklist
- Release process

---

## Resources

- [Express.js Docs](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
