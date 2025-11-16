import { Request, Response, NextFunction } from 'express';
import { StarsP2PService } from '@tg-payment/core';

export class P2POrdersController {
  constructor(private p2pService: StarsP2PService) {}

  async createSellOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { starsAmount, rate } = req.body;
      const userId = (req as any).user.id;

      if (!starsAmount || !rate) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'starsAmount and rate required' }
        });
      }

      const order = await this.p2pService.createSellOrder(userId, starsAmount, rate);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  async createBuyOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { tonAmount, maxRate } = req.body;
      const userId = (req as any).user.id;

      if (!tonAmount || !maxRate) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'tonAmount and maxRate required' }
        });
      }

      const order = await this.p2pService.createBuyOrder(userId, tonAmount, maxRate);
      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  async listOpenOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.query;
      const orders = await this.p2pService.getOpenOrders(type as any);
      res.json({ success: true, data: orders, count: orders.length });
    } catch (error) {
      next(error);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const order = await this.p2pService.getOrderById(orderId);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' }
        });
      }

      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  async triggerMatching(req: Request, res: Response, next: NextFunction) {
    try {
      const matchesCount = await this.p2pService.matchOrders();
      res.json({ success: true, data: { matchesCount } });
    } catch (error) {
      next(error);
    }
  }
}
