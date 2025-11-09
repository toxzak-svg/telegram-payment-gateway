import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { RateAggregatorService, FragmentService } from '@tg-payment/core';
import { logger } from '../utils/logger';
import config from '../config';

// Don't initialize here - do it lazily in methods
let rateService: RateAggregatorService | null = null;
let fragmentService: FragmentService | null = null;

const getRateService = () => {
  if (!rateService) {
    rateService = new RateAggregatorService(config.apis.coingeckoKey);
  }
  return rateService;
};

const getFragmentService = () => {
  if (!fragmentService) {
    try {
      fragmentService = new FragmentService(config.fragment.apiKey || 'dev-key');
    } catch (error) {
      logger.warn('Fragment service warning', error);
      // Return a mock for dev
      return {
        initiateConversion: async () => ({ id: 'mock', status: 'pending' }),
      } as any;
    }
  }
  return fragmentService;
};

export class ConversionController {
  /**
   * POST /api/v1/conversions/estimate
   * Estimate conversion with current rates
   */
  static async estimateConversion(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      const { starsAmount, targetCurrency } = req.body;

      if (!starsAmount || !targetCurrency) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'starsAmount and targetCurrency required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      // Get rate
      const rate = await getRateService().getAggregatedRate('STARS', targetCurrency);

      // Calculate conversion
      const tonAmount = starsAmount * rate.rate;
      const fees = {
        telegram: starsAmount * 0.02, // 2%
        fragment: tonAmount * 0.01, // 1%
        exchange: 0,
      };

      return res.status(200).json({
        success: true,
        data: {
          starsAmount,
          targetCurrency,
          exchangeRate: rate.rate,
          estimatedTarget: tonAmount - fees.fragment,
          fees,
          total: tonAmount - fees.fragment - fees.exchange,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Estimate error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'ESTIMATION_FAILED', message: 'Failed to estimate conversion' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/v1/conversions/create
   * Create new conversion
   */
  static async createConversion(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      const { paymentIds, targetCurrency } = req.body;

      if (!paymentIds || !targetCurrency) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'paymentIds and targetCurrency required' },
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      // Get rate
      const rate = await getRateService().getAggregatedRate('STARS', targetCurrency);

      // Initiate conversion
      const conversion = await getFragmentService().initiateConversion(
        req.apiKey || 'unknown',
        paymentIds,
        5000, // Mock amount - in production would aggregate from payments
        rate.rate
      );

      return res.status(201).json({
        success: true,
        data: conversion,
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Create conversion error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'CONVERSION_FAILED', message: 'Failed to create conversion' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/v1/conversions/:id/status
   * Get conversion status
   */
  static async getConversionStatus(req: AuthenticatedRequest, res: Response) {
    const requestId = req.requestId || uuid();

    try {
      const { id } = req.params;

      // In production, would fetch from database
      return res.status(200).json({
        success: true,
        data: {
          id,
          status: 'processing',
          progress: 65,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get status error', { requestId, error });
      return res.status(500).json({
        success: false,
        error: { code: 'STATUS_FAILED', message: 'Failed to get conversion status' },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
