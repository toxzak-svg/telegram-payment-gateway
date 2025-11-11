import { Response, Request } from 'express';
import { v4 as uuid } from 'uuid';
import { pool } from '../db/connection';
import crypto from 'crypto';

interface UserRecord {
  id: string;
  api_key: string;
  api_secret: string;
  app_name: string;
  description?: string;
  webhook_url?: string;
  kyc_status: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class UserController {
  /**
   * POST /api/v1/users/register
   * Register new user/application
   */
  static async register(req: Request, res: Response) {
    const requestId = uuid();

    try {
      const { appName, description, webhookUrl } = req.body;

      if (!appName) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_APP_NAME', message: 'appName is required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      // Generate API keys
      const apiKey = `pk_${crypto.randomBytes(24).toString('hex')}`;
      const apiSecret = `sk_${crypto.randomBytes(32).toString('hex')}`;

      // Insert user
      const result = await pool.query<UserRecord>(
        `INSERT INTO users (api_key, api_secret, app_name, description, webhook_url, kyc_status, is_active)
         VALUES ($1, $2, $3, $4, $5, 'pending', true)
         RETURNING *`,
        [apiKey, apiSecret, appName, description || null, webhookUrl || null]
      );

      const user = result.rows[0];

      console.log('✅ User registered:', { requestId, userId: user.id, appName });

      return res.status(201).json({
        success: true,
        user: {
          id: user.id,
          appName: user.app_name,
          apiKey: user.api_key,
          apiSecret: user.api_secret,
          webhookUrl: user.webhook_url,
          kycStatus: user.kyc_status,
          createdAt: user.created_at,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('❌ Registration error:', { requestId, error: error.message });
      return res.status(500).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message: 'Failed to register user' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/v1/users/me
   * Get current user profile
   */
  static async getMe(req: Request, res: Response) {
    const requestId = uuid();
    const apiKey = req.headers['x-api-key'] as string;

    try {
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'API key required' },
          requestId,
        });
      }

      const result = await pool.query<UserRecord>(
        'SELECT * FROM users WHERE api_key = $1',
        [apiKey]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          requestId,
        });
      }

      const user = result.rows[0];

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          appName: user.app_name,
          apiKey: user.api_key,
          webhookUrl: user.webhook_url,
          kycStatus: user.kyc_status,
          isActive: user.is_active,
          createdAt: user.created_at,
        },
        requestId,
      });
    } catch (error) {
      console.error('❌ Get profile error:', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to get profile' },
        requestId,
      });
    }
  }

  /**
   * POST /api/v1/users/api-keys/regenerate
   * Regenerate API key
   */
  static async regenerateApiKey(req: Request, res: Response) {
    const requestId = uuid();
    const apiKey = req.headers['x-api-key'] as string;

    try {
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'API key required' },
          requestId,
        });
      }

      const newApiKey = `pk_${crypto.randomBytes(24).toString('hex')}`;
      const newApiSecret = `sk_${crypto.randomBytes(32).toString('hex')}`;

      const result = await pool.query(
        `UPDATE users SET api_key = $1, api_secret = $2, updated_at = NOW()
         WHERE api_key = $3
         RETURNING api_key, api_secret`,
        [newApiKey, newApiSecret, apiKey]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          requestId,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          apiKey: result.rows[0].api_key,
          apiSecret: result.rows[0].api_secret,
          message: 'API keys regenerated successfully',
        },
        requestId,
      });
    } catch (error) {
      console.error('❌ Regenerate key error:', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'REGENERATE_FAILED', message: 'Failed to regenerate API key' },
        requestId,
      });
    }
  }

  /**
   * GET /api/v1/users/stats
   * Get user statistics
   */
  static async getStats(req: Request, res: Response) {
    const requestId = uuid();
    const apiKey = req.headers['x-api-key'] as string;

    try {
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'API key required' },
          requestId,
        });
      }

      // Get user
      const userResult = await pool.query('SELECT id FROM users WHERE api_key = $1', [apiKey]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          requestId,
        });
      }

      const userId = userResult.rows[0].id;

      // Get stats
      const statsResult = await pool.query(
        `SELECT 
          COUNT(*) as total_payments,
          COALESCE(SUM(stars_amount), 0) as total_stars,
          COUNT(CASE WHEN status = 'received' THEN 1 END) as successful_payments
         FROM payments 
         WHERE user_id = $1`,
        [userId]
      );

      return res.status(200).json({
        success: true,
        stats: {
          totalPayments: parseInt(statsResult.rows[0].total_payments),
          totalStars: parseFloat(statsResult.rows[0].total_stars),
          successfulPayments: parseInt(statsResult.rows[0].successful_payments),
        },
        requestId,
      });
    } catch (error) {
      console.error('❌ Get stats error:', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to get statistics' },
        requestId,
      });
    }
  }
}
