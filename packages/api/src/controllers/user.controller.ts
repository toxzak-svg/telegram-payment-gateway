import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UserRepository } from '../models/user.repository';
import { ValidationError } from '@tg-payment/core';
import { dbConnection } from '../db/connection';
import { logger } from '../utils/logger';

let userRepo: UserRepository | null = null;

const getUserRepository = async () => {
  if (!userRepo) {
    const db = dbConnection.getInstance();
    userRepo = new UserRepository(db);
  }
  return userRepo;
};

export class UserController {
  /**
   * POST /api/v1/users/register
   * Register new user/application
   */
  static async register(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      const { appName, webhookUrl } = req.body;

      if (!appName) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_APP_NAME', message: 'appName is required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const userRepo = await getUserRepository();
      const user = await userRepo.create({ appName, webhookUrl });

      logger.info('User registered', { requestId, userId: user.id, appName });

      return res.status(201).json({
        success: true,
        data: {
          id: user.id,
          appName: user.appName,
          apiKey: user.apiKey,
          apiSecret: user.apiSecret,
          webhookUrl: user.webhookUrl,
          kycStatus: user.kycStatus,
          createdAt: user.createdAt,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: { code: error.code, message: error.message },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      logger.error('Registration error', { requestId, error });
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
  static async getMe(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      if (!req.apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'API key required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const userRepo = await getUserRepository();
      const user = await userRepo.findByApiKey(req.apiKey);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const stats = await userRepo.getStats(user.id);

      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          appName: user.appName,
          apiKey: user.apiKey,
          webhookUrl: user.webhookUrl,
          kycStatus: user.kycStatus,
          isActive: user.isActive,
          stats,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get profile error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to get profile' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/v1/users/api-keys/regenerate
   * Regenerate API key
   */
  static async regenerateApiKey(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      if (!req.apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'API key required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const userRepo = await getUserRepository();
      const user = await userRepo.findByApiKey(req.apiKey);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const newKeys = await userRepo.regenerateApiKey(user.id);

      logger.info('API key regenerated', { requestId, userId: user.id });

      return res.status(200).json({
        success: true,
        data: {
          apiKey: newKeys.apiKey,
          apiSecret: newKeys.apiSecret,
          message: 'API keys regenerated successfully',
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Regenerate key error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'REGENERATE_FAILED', message: 'Failed to regenerate API key' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/v1/users/stats
   * Get user statistics
   */
  static async getStats(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      if (!req.apiKey) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'API key required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const userRepo = await getUserRepository();
      const user = await userRepo.findByApiKey(req.apiKey);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      const stats = await userRepo.getStats(user.id);

      return res.status(200).json({
        success: true,
        data: stats,
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get stats error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to get statistics' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
