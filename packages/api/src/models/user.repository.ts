import { ExtendedDatabase } from '../db/connection';
import { ValidationError } from '@tg-payment/core';
import crypto from 'crypto';

export interface User {
  id: string;
  appName: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl?: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
  isActive: boolean;
  totalStarsReceived: number;
  totalConversions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  appName: string;
  webhookUrl?: string;
}

export class UserRepository {
  constructor(private db: ExtendedDatabase) {}

  /**
   * Create new user with API key
   */
  async create(data: CreateUserRequest): Promise<User> {
    if (!data.appName || data.appName.length < 3) {
      throw new ValidationError('App name must be at least 3 characters');
    }
    // Check app name
    const existing = await this.db.oneOrNone(
      'SELECT id FROM users WHERE app_name = $1',
      [data.appName]
    );
    if (existing) {
      throw new ValidationError('App name already exists');
    }
    // Secure key/secret
    const apiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const apiSecret = crypto.randomBytes(32).toString('hex');
    try {
      const user = await this.db.one(
        `INSERT INTO users (app_name, api_key, api_secret, webhook_url, kyc_status, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, app_name AS "appName", api_key AS "apiKey", api_secret AS "apiSecret",
                   webhook_url AS "webhookUrl", kyc_status AS "kycStatus", is_active AS "isActive",
                   total_stars_received AS "totalStarsReceived", total_conversions AS "totalConversions",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [data.appName, apiKey, apiSecret, data.webhookUrl || null, 'pending', true]
      );
      return user;
    } catch (error: any) {
      if (error.message.includes('unique')) {
        throw new ValidationError('App name already exists');
      }
      throw error;
    }
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    const user = await this.db.oneOrNone(
      `SELECT id, app_name AS "appName", api_key AS "apiKey", api_secret AS "apiSecret",
              webhook_url AS "webhookUrl", kyc_status AS "kycStatus", is_active AS "isActive",
              total_stars_received AS "totalStarsReceived", total_conversions AS "totalConversions",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE api_key = $1 AND is_active = true`,
      [apiKey]
    );
    return user || null;
  }

  async regenerateApiKey(userId: string): Promise<{ apiKey: string; apiSecret: string }> {
    const newApiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const newApiSecret = crypto.randomBytes(32).toString('hex');
    await this.db.none(
      'UPDATE users SET api_key = $1, api_secret = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [newApiKey, newApiSecret, userId]
    );
    return { apiKey: newApiKey, apiSecret: newApiSecret };
  }

  // ... other methods unchanged ...
}
