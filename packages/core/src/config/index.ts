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
