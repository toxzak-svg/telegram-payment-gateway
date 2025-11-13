import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '@tg-payment/core';

/**
 * Authenticate API key from header
 */
async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed: API key is required'
        }
      });
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('pk_') || apiKey.length < 20) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed: Invalid API key format'
        }
      });
      return;
    }

    const db = getDatabase();
    
    // Look up user by API key
    const user = await db.oneOrNone(
      'SELECT id, api_key, is_active FROM users WHERE api_key = $1',
      [apiKey]
    );

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed: Invalid API key'
        }
      });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed: Account is inactive'
        }
      });
      return;
    }

    // Attach user ID to request headers for downstream use
    req.headers['x-user-id'] = user.id;

    next();
  } catch (error: any) {
    console.error('❌ Authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed: Internal server error'
      }
    });
  }
}

/**
 * Optional authentication (doesn't fail if no API key)
 */
async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    next();
    return;
  }

  // If API key is provided, validate it
  await authenticateApiKey(req, res, next);
}

export default authenticateApiKey;
export { optionalAuth };
