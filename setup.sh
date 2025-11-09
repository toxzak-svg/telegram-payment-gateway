#!/bin/bash

echo "🔧 Telegram Payment Gateway - Automated Fix Script"
echo "=================================================="

# Step 1: Rename docker-compose file
echo "Step 1: Renaming docker_compose.yml to docker-compose.yml..."
if [ -f "docker_compose.yml" ]; then
    mv docker_compose.yml docker-compose.yml
    echo "✓ Renamed successfully"
else
    echo "⚠ docker_compose.yml not found, skipping..."
fi

# Step 2: Create scripts directory
echo ""
echo "Step 2: Creating scripts directory..."
mkdir -p packages/api/scripts
echo "✓ Directory created"

# Step 3: Create migrate.js
echo ""
echo "Step 3: Creating migration script..."
cat > packages/api/scripts/migrate.js << 'EOF'
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(\`Running migration: \${file}\`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        console.log(\`✓ \${file} completed\`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
EOF
echo "✓ migrate.js created"

# Step 4: Create seed.js
echo ""
echo "Step 4: Creating seed script..."
cat > packages/api/scripts/seed.js << 'EOF'
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runSeeds() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const seedsDir = path.join(__dirname, '../../../database/seeds');
    const files = fs.readdirSync(seedsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(\`Running seed: \${file}\`);
        const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
        await client.query(sql);
        console.log(\`✓ \${file} completed\`);
      }
    }

    console.log('All seeds completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSeeds();
EOF
echo "✓ seed.js created"

# Step 5: Create config directory
echo ""
echo "Step 5: Creating config directory..."
mkdir -p packages/core/src/config
echo "✓ Directory created"

# Step 6: Create config/index.ts
echo ""
echo "Step 6: Creating configuration file..."
cat > packages/core/src/config/index.ts << 'EOF'
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  
  database: {
    url: process.env.DATABASE_URL || '',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  },
  
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  },
  
  ton: {
    apiKey: process.env.TON_API_KEY || '',
    apiUrl: process.env.TON_API_URL || 'https://tonx.space/api',
    mainnet: process.env.TON_MAINNET === 'true',
  },
  
  security: {
    apiSecretKey: process.env.API_SECRET_KEY || '',
    jwtSecret: process.env.JWT_SECRET || '',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  features: {
    enableRateLocking: process.env.ENABLE_RATE_LOCKING === 'true',
    enableWebhooks: process.env.ENABLE_WEBHOOKS === 'true',
    batchConversionMinStars: parseInt(process.env.BATCH_CONVERSION_MIN_STARS || '1000', 10),
  },
};

export default config;
EOF
echo "✓ config/index.ts created"

# Step 7: Update server.ts
echo ""
echo "Step 7: Creating server.ts implementation..."
cat > packages/core/src/server.ts << 'EOF'
// Core server utilities and shared functionality
export class ServerBase {
  protected port: number;
  protected environment: string;

  constructor(port: number = 3000, environment: string = 'development') {
    this.port = port;
    this.environment = environment;
  }

  protected validateEnvironment(): void {
    const requiredEnvVars = [
      'DATABASE_URL',
      'TELEGRAM_BOT_TOKEN',
      'API_SECRET_KEY'
    ];

    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(\`Missing required environment variables: \${missing.join(', ')}\`);
    }
  }

  protected logServerStart(): void {
    console.log(\`🚀 Server started in \${this.environment} mode\`);
    console.log(\`📡 Listening on port \${this.port}\`);
    console.log(\`🔗 API URL: http://localhost:\${this.port}\`);
  }

  protected setupGracefulShutdown(cleanup: () => Promise<void>): void {
    const shutdown = async (signal: string) => {
      console.log(\`\\n\${signal} received. Starting graceful shutdown...\`);
      await cleanup();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

export default ServerBase;
EOF
echo "✓ server.ts created"

# Step 8: Create .dockerignore
echo ""
echo "Step 8: Creating .dockerignore..."
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
dist
.env
.git
.gitignore
README.md
.vscode
.idea
*.log
coverage
.DS_Store
EOF
echo "✓ .dockerignore created"

# Step 9: Create seed data
echo ""
echo "Step 9: Creating sample seed data..."
cat > database/seeds/001_sample_data.sql << 'EOF'
-- Sample seed data for development
-- Insert sample user
INSERT INTO users (id, apikey, apisecret, appname, webhookurl, kycstatus)
VALUES 
  (gen_random_uuid(), 'dev_api_key_123', 'dev_api_secret_456', 'Dev Test App', 'http://localhost:3001/webhook', 'pending')
ON CONFLICT DO NOTHING;

-- Sample exchange rates
INSERT INTO exchangerates (id, sourcecurrency, targetcurrency, rate, source)
VALUES
  (gen_random_uuid(), 'STARS', 'TON', 0.0013, 'fragment'),
  (gen_random_uuid(), 'TON', 'USD', 2.45, 'coingecko'),
  (gen_random_uuid(), 'TON', 'EUR', 2.28, 'coingecko')
ON CONFLICT DO NOTHING;

COMMIT;
EOF
echo "✓ Seed data created"

echo ""
echo "=================================================="
echo "✅ All files created successfully!"
echo ""
echo "Next steps:"
echo "1. Update package.json files manually (see setup-instructions.md)"
echo "2. Run: npm install"
echo "3. Run: docker-compose up -d postgres"
echo "4. Run: npm run db:migrate"
echo "5. Run: npm run db:seed"
echo "6. Run: npm run build"
echo "7. Run: npm run dev"
echo ""
echo "For detailed instructions, see setup-instructions.md"
