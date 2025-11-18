import { Request, Response, NextFunction } from 'express';
import { DexAggregatorService, P2PLiquidityService } from '@tg-payment/core';
import { getDatabase } from '../db/connection';

/**
 * DEX Controller
 * 
 * Handles DEX aggregation and liquidity routing endpoints.
 */
export class DexController {
  /**
   * GET /api/v1/dex/quote
   * Get best rate quote from all DEX sources
   */
  static async getQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromToken, toToken, amount } = req.query;
      
      if (!fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_PARAMS', 
            message: 'Missing required parameters: fromToken, toToken, amount' 
          },
        });
      }

      const dexAggregator = new DexAggregatorService();
      const quote = await dexAggregator.getBestRate(
        fromToken as string,
        toToken as string,
        parseFloat(amount as string)
      );

      res.json({ 
        success: true, 
        data: {
          ...quote,
          timestamp: Date.now(),
          validFor: 30, // seconds
        }
      });
    } catch (error: any) {
      console.error('DEX quote error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QUOTE_FAILED',
          message: error.message || 'Failed to get DEX quote',
        },
      });
    }
  }

  /**
   * POST /api/v1/dex/swap
   * Execute swap through selected DEX
   */
  static async executeSwap(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider, poolId, fromToken, toToken, amount, minOutput } = req.body;

      if (!provider || !poolId || !fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: { 
            code: 'INVALID_PARAMS', 
            message: 'Missing required parameters: provider, poolId, fromToken, toToken, amount' 
          },
        });
      }

      if (!['dedust', 'stonfi'].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PROVIDER',
            message: 'Provider must be either "dedust" or "stonfi"',
          },
        });
      }

      const dexAggregator = new DexAggregatorService();
      const result = await dexAggregator.executeSwap(
        provider,
        poolId,
        fromToken,
        toToken,
        amount,
        minOutput || amount * 0.95 // 5% slippage tolerance by default
      );

      res.json({ 
        success: true, 
        data: {
          ...result,
          provider,
          poolId,
          timestamp: Date.now(),
        }
      });
    } catch (error: any) {
      console.error('DEX swap error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SWAP_FAILED',
          message: error.message || 'Failed to execute DEX swap',
        },
      });
    }
  }

  /**
   * GET /api/v1/dex/liquidity
   * Get all available liquidity sources for a conversion
   */
  static async getLiquidity(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromCurrency, toCurrency, amount } = req.query;

      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Missing required parameters: fromCurrency, toCurrency, amount',
          },
        });
      }

      const db = getDatabase();
      const p2pLiquidityService = new P2PLiquidityService(db);
      
      const sources = await p2pLiquidityService.getAllLiquiditySources(
        fromCurrency as string,
        toCurrency as string,
        parseFloat(amount as string)
      );

      res.json({
        success: true,
        data: {
          sources,
          timestamp: Date.now(),
        },
      });
    } catch (error: any) {
      console.error('Liquidity query error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LIQUIDITY_QUERY_FAILED',
          message: error.message || 'Failed to query liquidity sources',
        },
      });
    }
  }

  /**
   * GET /api/v1/dex/route
   * Find best conversion route (P2P or DEX)
   */
  static async getBestRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromCurrency, toCurrency, amount } = req.query;

      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Missing required parameters: fromCurrency, toCurrency, amount',
          },
        });
      }

      const db = getDatabase();
      const p2pLiquidityService = new P2PLiquidityService(db);
      
      const route = await p2pLiquidityService.findBestRoute(
        fromCurrency as string,
        toCurrency as string,
        parseFloat(amount as string)
      );

      res.json({
        success: true,
        data: {
          ...route,
          timestamp: Date.now(),
        },
      });
    } catch (error: any) {
      console.error('Route finding error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ROUTE_FINDING_FAILED',
          message: error.message || 'Failed to find best route',
        },
      });
    }
  }
}

export default DexController;
