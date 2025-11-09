import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface AppConfig {
  app: {
    env: string;
    port: number;
    apiUrl: string;
    logLevel: string;
  };
  database: {
    url: string;
    poolMin: number;
    poolMax: number;
  };
  telegram: {
    botToken: string;
    webhookSecret: string;
  };
  fragment: {
    apiKey: string;
    apiUrl: string;
  };
  ton: {
    apiKey: string;
    apiUrl: string;
    isMainnet: boolean;
  };
  apis: {
    coingeckoKey?: string;
    coinmarketcapKey?: string;
  };
  security: {
    apiSecretKey: string;
    jwtSecret: string;
    webhookSecret: string;
  };
  features: {
    enableRateLocking: boolean;
    enableWebhooks: boolean;
    batchConversionMinStars: number;
  };
}

const config: AppConfig = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  },
  fragment: {
    apiKey: process.env.FRAGMENT_API_KEY || '',
    apiUrl: process.env.FRAGMENT_API_URL || 'https://fragment.com/api',
  },
  ton: {
    apiKey: process.env.TON_API_KEY || '',
    apiUrl: process.env.TON_API_URL || 'https://tonx.space/api',
    isMainnet: process.env.TON_MAINNET === 'true',
  },
  apis: {
    coingeckoKey: process.env.COINGECKO_API_KEY,
    coinmarketcapKey: process.env.COINMARKETCAP_API_KEY,
  },
  security: {
    apiSecretKey: process.env.API_SECRET_KEY || '',
    jwtSecret: process.env.JWT_SECRET || '',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
  },
  features: {
    enableRateLocking: process.env.ENABLE_RATE_LOCKING !== 'false',
    enableWebhooks: process.env.ENABLE_WEBHOOKS !== 'false',
    batchConversionMinStars: parseInt(process.env.BATCH_CONVERSION_MIN_STARS || '1000', 10),
  },
};

export default config;
