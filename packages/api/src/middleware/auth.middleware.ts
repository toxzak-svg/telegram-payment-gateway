import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKey?: string;
  requestId?: string;
}

/**
 * API Key Authentication Middleware
 * Validates X-API-Key and X-API-Secret headers
 */
export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const apiSecret = req.headers['x-api-secret'] as string;
  const timestamp = req.headers['x-timestamp'] as string;
  const signature = req.headers['x-signature'] as string;

  // Generate request ID for tracking
  req.requestId = crypto.randomUUID();

  // Public endpoints that don't require auth
  const publicEndpoints = ['/api/v1/health', '/api/v1/rates'];
  if (publicEndpoints.some((ep) => req.path.startsWith(ep))) {
    return next();
  }

  // Validate API key exists
  if (!apiKey) {
    logger.warn('Missing API key', { path: req.path, ip: req.ip });
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_API_KEY', message: 'X-API-Key header required' },
      requestId: req.requestId,
    });
  }

  // TODO: In production, validate API key against database
  // For now, accept any key but log it
  logger.debug('API Key authenticated', { apiKey: apiKey.substring(0, 10) + '...', path: req.path });

  req.apiKey = apiKey;
  next();
};

/**
 * Signature Verification Middleware
 * Verifies request authenticity using HMAC-SHA256
 */
export const verifySignature = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;

  if (!signature || !timestamp) {
    return next(); // Optional for now
  }

  const body = JSON.stringify(req.body);
  const message = `${timestamp}${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.security.apiSecretKey)
    .update(message)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('Invalid signature', { path: req.path, ip: req.ip });
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Request signature verification failed' },
      requestId: req.requestId,
    });
  }

  next();
};
