import { Request, Response, NextFunction } from 'express';
import { DirectConversionService, TonPaymentService } from '@tg-payment/core';
import { pool } from '../db/connection';

// Interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    telegramId: string;
    username?: string;
  };
}

class TonServiceStub {
  async sendTon(): Promise<string> {
    throw new Error('TON wallet not configured. Set TON_WALLET_MNEMONIC to enable conversions.');
  }
}

export class ConversionController {
  private conversionService: DirectConversionService;

  constructor() {
    const tonService = this.createTonService();
    const minStars = parseInt(process.env.MIN_CONVERSION_STARS || '100', 10);
    this.conversionService = new DirectConversionService(pool, tonService, minStars);
  }

  private createTonService(): TonPaymentService {
    const mnemonic = process.env.TON_WALLET_MNEMONIC;
    if (!mnemonic) {
      console.warn('⚠️ TON_WALLET_MNEMONIC missing. Conversion execution will be disabled.');
      return new TonServiceStub() as unknown as TonPaymentService;
    }

    return new TonPaymentService({
      endpoint: process.env.TON_API_ENDPOINT || process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY,
      mnemonic,
      workchain: process.env.TON_WORKCHAIN ? parseInt(process.env.TON_WORKCHAIN, 10) : undefined,
    });
  }

  /**
   * Get conversion rate quote
   * GET /api/v1/conversions/rate
   */
  async getRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount = 100, sourceCurrency = 'STARS', targetCurrency = 'TON' } = req.query;

      const quote = await this.conversionService.getQuote(
        parseFloat(amount as string),
        sourceCurrency as string,
        targetCurrency as string
      );

      res.json({
        success: true,
        data: quote
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new conversion request (locks rate)
   * POST /api/v1/conversions
   */
  async createConversion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, sourceCurrency = 'STARS', targetCurrency = 'TON', durationSeconds = 300 } = req.body;

      if (!amount) {
        res.status(400).json({
          success: false,
          error: 'amount is required'
        });
        return;
      }

      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const conversion = await this.conversionService.lockRate(
        userId,
        parseFloat(amount),
        sourceCurrency,
        targetCurrency,
        durationSeconds
      );

      res.status(201).json({
        success: true,
        data: conversion
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get conversion by ID
   * GET /api/v1/conversions/:id
   */
  async getConversion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const conversion = await this.conversionService.getConversionById(id);

      if (!conversion) {
        res.status(404).json({
          success: false,
          error: 'Conversion not found'
        });
        return;
      }

      res.json({
        success: true,
        data: conversion
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's conversion history
   * GET /api/v1/conversions
   */
  async getConversionHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status } = req.query;

      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const conversions = await this.conversionService.getUserConversions(userId);

      // Filter by status if provided
      const filtered = status 
        ? conversions.filter(c => c.status === status)
        : conversions;

      // Simple pagination
      const offset = (Number(page) - 1) * Number(limit);
      const paginated = filtered.slice(offset, offset + Number(limit));

      res.json({
        success: true,
        data: {
          conversions: paginated,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / Number(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }


}

// Export instance methods
const controller = new ConversionController();

export const getRate = controller.getRate.bind(controller);
export const createConversion = controller.createConversion.bind(controller);
export const getConversion = controller.getConversion.bind(controller);
export const getConversionHistory = controller.getConversionHistory.bind(controller);
