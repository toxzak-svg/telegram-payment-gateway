import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/connection';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    apiKey: string;
    appName: string;
    isActive: boolean;
  };
  requestId?: string;
}

/**
 * Middleware to validate API key and attach user to request
 */
export async function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get API key from header or query param
    const apiKey = 
      req.headers['x-api-key'] as string ||
      req.headers['authorization']?.replace('Bearer ', '') ||
      req.query.api_key as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key is required. Provide it in X-API-Key header or api_key query parameter',
        },
      });
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('pk_') && !apiKey.startsWith('sk_')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY_FORMAT',
          message: 'API key must start with pk_ or sk_',
        },
      });
      return;
    }

    // Look up user by API key
    const result = await pool.query(
      `SELECT id, api_key, app_name, is_active 
       FROM users 
       WHERE api_key = $1`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      });
      return;
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Your account has been deactivated',
        },
      });
      return;
    }

    // Update last activity
    pool.query(
      'UPDATE users SET last_activity_at = NOW() WHERE id = $1',
      [user.id]
    ).catch(err => console.error('Failed to update last_activity:', err));

    // Attach user to request
    req.user = {
      id: user.id,
      apiKey: user.api_key,
      appName: user.app_name,
      isActive: user.is_active,
    };

    // Also set X-User-Id header for backward compatibility
    req.headers['x-user-id'] = user.id;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Optional auth - allows both authenticated and unauthenticated requests
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = 
    req.headers['x-api-key'] as string ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    // No API key provided, continue without auth
    next();
    return;
  }

  // If API key provided, validate it
  authenticateApiKey(req, res, next);
}

/**
 * Webhook authentication (validates webhook secret)
 */
export function authenticateWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const webhookSecret = req.headers['x-webhook-secret'] as string;
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!webhookSecret) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_WEBHOOK_SECRET',
        message: 'Webhook secret required',
      },
    });
    return;
  }

  if (webhookSecret !== expectedSecret) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_WEBHOOK_SECRET',
        message: 'Invalid webhook secret',
      },
    });
    return;
  }

  next();
}

export default {
  authenticateApiKey,
  optionalAuth,
  authenticateWebhook,
};
