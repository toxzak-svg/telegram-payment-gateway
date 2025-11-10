import { config } from 'dotenv';
import path from 'path';

// Load .env from project root (two levels up from api/src/config)
config({ path: path.resolve(__dirname, '../../../.env') });

console.log('🔍 DEBUG - DATABASE_URL from env:', process.env.DATABASE_URL);

export default {
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    apiUrl: process.env.API_URL || 'http://localhost:3000'
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev',
    poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10)
  },
  security: {
    apiSecretKey: process.env.API_SECRET_KEY || 'dev_secret_key_change_in_production',
    jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret',
    webhookSecret: process.env.WEBHOOK_SECRET || 'dev_webhook_secret'
  }
};
