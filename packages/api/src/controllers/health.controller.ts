import { Response } from 'express';
import { Request } from 'express';
import { RateAggregatorService } from '@tg-payment/core';
import config from '../config';
import { logger } from '../utils/logger';

const rateService = new RateAggregatorService(config.apis.coingeckoKey);

export class HealthController {
  /**
   * GET /api/v1/health
   * Health check endpoint
   */
  static async health(req: Request, res: Response) {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.app.env,
      },
    });
  }

  /**
   * GET /api/v1/rates
   * Get current exchange rates
   */
  static async getRates(req: Request, res: Response) {
    try {
      const pairs = [
        { from: 'STARS', to: 'TON' },
        { from: 'TON', to: 'USD' },
        { from: 'TON', to: 'EUR' },
        { from: 'STARS', to: 'USD' },
      ];

      const rates = await Promise.all(
        pairs.map(async (pair) => {
          try {
            const rate = await rateService.getAggregatedRate(pair.from, pair.to);
            return {
              from: pair.from,
              to: pair.to,
              rate: rate.rate,
              timestamp: rate.timestamp,
            };
          } catch (error) {
            logger.warn(`Failed to fetch rate for ${pair.from}-${pair.to}`);
            return null;
          }
        })
      );

      return res.status(200).json({
        success: true,
        data: rates.filter((r) => r !== null),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Rates error', { error });
      return res.status(500).json({
        success: false,
        error: { code: 'RATES_ERROR', message: 'Failed to fetch rates' },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
