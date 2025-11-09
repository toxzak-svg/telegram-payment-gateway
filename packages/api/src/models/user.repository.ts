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
    // Validate app name
    if (!data.appName || data.appName.length < 3) {
      throw new ValidationError('App name must be at least 3 characters');
    }

    // Check if app name already exists
    const existing = await this.db.oneOrNone(
      'SELECT id FROM users WHERE app_name = $1',
      [data.appName]
    );

    if (existing) {
      throw new ValidationError('App name already exists');
    }

    // Generate API key and secret
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

  /**
   * Find user by API key
   */
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

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const user = await this.db.oneOrNone(
      `SELECT id, app_name AS "appName", api_key AS "apiKey", api_secret AS "apiSecret",
              webhook_url AS "webhookUrl", kyc_status AS "kycStatus", is_active AS "isActive",
              total_stars_received AS "totalStarsReceived", total_conversions AS "totalConversions",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE id = $1`,
      [id]
    );

    return user || null;
  }

  /**
   * Update KYC status
   */
  async updateKycStatus(userId: string, status: 'pending' | 'verified' | 'rejected'): Promise<User> {
    const user = await this.db.one(
      `UPDATE users SET kyc_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, app_name AS "appName", api_key AS "apiKey", api_secret AS "apiSecret",
                 webhook_url AS "webhookUrl", kyc_status AS "kycStatus", is_active AS "isActive",
                 total_stars_received AS "totalStarsReceived", total_conversions AS "totalConversions",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [status, userId]
    );

    return user;
  }

  /**
   * Regenerate API key
   */
  async regenerateApiKey(userId: string): Promise<{ apiKey: string; apiSecret: string }> {
    const newApiKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const newApiSecret = crypto.randomBytes(32).toString('hex');

    await this.db.none(
      'UPDATE users SET api_key = $1, api_secret = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [newApiKey, newApiSecret, userId]
    );

    return { apiKey: newApiKey, apiSecret: newApiSecret };
  }

  /**
   * Get user statistics
   */
  async getStats(userId: string): Promise<any> {
    const stats = await this.db.one(
      `SELECT
        COUNT(CASE WHEN p.status = 'received' THEN 1 END) AS payments_count,
        COALESCE(SUM(CASE WHEN p.status = 'received' THEN p.stars_amount END), 0) AS total_stars,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) AS conversions_count,
        COALESCE(SUM(CASE WHEN c.status = 'completed' THEN c.target_amount END), 0) AS total_converted
       FROM payments p
       LEFT JOIN conversions c ON p.user_id = c.user_id
       WHERE p.user_id = $1`,
      [userId]
    );

    return {
      paymentsCount: parseInt(stats.payments_count),
      totalStars: parseFloat(stats.total_stars),
      conversionsCount: parseInt(stats.conversions_count),
      totalConverted: parseFloat(stats.total_converted),
    };
  }

  /**
   * List all users (admin)
   */
  async list(limit = 50, offset = 0): Promise<{ users: User[]; total: number }> {
    const users = await this.db.manyOrNone(
      `SELECT id, app_name AS "appName", api_key AS "apiKey", api_secret AS "apiSecret",
              webhook_url AS "webhookUrl", kyc_status AS "kycStatus", is_active AS "isActive",
              total_stars_received AS "totalStarsReceived", total_conversions AS "totalConversions",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await this.db.one('SELECT COUNT(*) as count FROM users');

    return {
      users,
      total: parseInt(countResult.count),
    };
  }

  /**
   * Deactivate user
   */
  async deactivate(userId: string): Promise<void> {
    await this.db.none(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }
}
