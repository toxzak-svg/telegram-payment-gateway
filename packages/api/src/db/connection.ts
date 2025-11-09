import pgPromise from 'pg-promise';
import config from '../config';
import { logger } from '../utils/logger';

// Extended IDatabase interface
export interface IExtensions {
  users: any;
  payments: any;
}

export type ExtendedDatabase = any;

class DatabaseConnection {
  private db: ExtendedDatabase | null = null;
  private pgp: any = null;

  /**
   * Initialize database connection
   */
  async initialize(): Promise<ExtendedDatabase> {
    try {
      this.pgp = pgPromise({
        receive(data: any) {
          // Convert timestamps
          if (data.created_at instanceof Date) {
            data.createdAt = data.created_at;
          }
          if (data.updated_at instanceof Date) {
            data.updatedAt = data.updated_at;
          }
        },
      });

      this.db = this.pgp(config.database.url);

      // Test connection
      await this.db.one('SELECT NOW()');
      logger.info('✅ Database connected successfully');

      return this.db;
    } catch (error) {
      logger.error('❌ Database connection failed', error);
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getInstance(): ExtendedDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Close connection pool
   */
  async close(): Promise<void> {
    if (this.pgp) {
      await this.pgp.end();
      logger.info('Database connection closed');
    }
  }

  /**
   * Run migrations
   */
  async runMigrations(): Promise<void> {
    const db = this.getInstance();
    try {
      logger.info('Running database migrations...');

      // Create tables
      await db.none(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          app_name VARCHAR(255) NOT NULL UNIQUE,
          api_key VARCHAR(255) NOT NULL UNIQUE,
          api_secret VARCHAR(255) NOT NULL,
          webhook_url VARCHAR(255),
          kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending',
          is_active BOOLEAN NOT NULL DEFAULT true,
          total_stars_received DECIMAL(20,2) DEFAULT 0,
          total_conversions DECIMAL(20,2) DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          telegram_payment_id VARCHAR(255) NOT NULL UNIQUE,
          stars_amount DECIMAL(20,2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'received',
          raw_payload JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS conversions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          payment_ids UUID[] NOT NULL,
          source_currency VARCHAR(10) NOT NULL,
          target_currency VARCHAR(10) NOT NULL,
          source_amount DECIMAL(20,2) NOT NULL,
          target_amount DECIMAL(20,2),
          exchange_rate DECIMAL(20,8),
          rate_locked_until BIGINT,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS withdrawals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          conversion_id UUID REFERENCES conversions(id),
          amount DECIMAL(20,2) NOT NULL,
          currency VARCHAR(10) NOT NULL,
          wallet_address VARCHAR(255) NOT NULL,
          tx_hash VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS exchange_rates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_currency VARCHAR(10) NOT NULL,
          target_currency VARCHAR(10) NOT NULL,
          rate DECIMAL(20,8) NOT NULL,
          provider VARCHAR(100) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
        CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
        CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
        CREATE INDEX IF NOT EXISTS idx_conversions_user_id ON conversions(user_id);
        CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);
        CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
        CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
        CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(source_currency, target_currency);
      `);

      logger.info('✅ Database migrations completed');
    } catch (error) {
      logger.error('❌ Migration failed', error);
      throw error;
    }
  }
}

export const dbConnection = new DatabaseConnection();
