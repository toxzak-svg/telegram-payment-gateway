import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config';
import { logger } from '../utils/logger';
import { UserRepository } from '../models/user.repository';
import { dbConnection } from '../db/connection';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKey?: string;
  requestId?: string;
}

let userRepo: UserRepository | null = null;
const getUserRepo = (): UserRepository => {
  if (!userRepo) {
    const db = dbConnection.getInstance();
    userRepo = new UserRepository(db);
  }
  return userRepo;
};

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  req.requestId = crypto.randomUUID();
  const publicEndpoints = ['/api/v1/health', '/api/v1/rates'];
  if (publicEndpoints.some((ep) => req.path.startsWith(ep))) return next();
  if (!apiKey) {
    logger.warn('Missing API key', { path: req.path, ip: req.ip });
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_API_KEY', message: 'X-API-Key header required' },
      requestId: req.requestId,
    });
  }
  // Validate API key in database
  const user = await getUserRepo().findByApiKey(apiKey);
  if (!user) {
    logger.warn('Invalid API key', { path: req.path, ip: req.ip });
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid or inactive API key' },
      requestId: req.requestId,
    });
  }
  req.apiKey = apiKey;
  req.userId = user.id;
  next();
};

export const verifySignature = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;
  const apiKey = req.apiKey;
  if (!signature || !timestamp || !apiKey) return next(); // optional for now

  const user = await getUserRepo().findByApiKey(apiKey);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Key not found for signature check' },
      requestId: req.requestId,
    });
  }
  const body = JSON.stringify(req.body);
  const message = `${timestamp}${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', user.apiSecret)
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
