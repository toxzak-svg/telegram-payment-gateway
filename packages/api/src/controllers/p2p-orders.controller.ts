import { Request, Response, NextFunction } from 'express';
import { getDatabase, StarsOrderModel, StarsP2PService } from '@tg-payment/core';

export class P2POrdersController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) return res.status(400).json({ success: false, error: { code: 'MISSING_USER_ID', message: 'X-User-Id header required' } });

      const { type, starsAmount, tonAmount, rate } = req.body;
      if (!type || (type !== 'sell' && type !== 'buy')) return res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'type must be "sell" or "buy"' } });
      if (!rate) return res.status(400).json({ success: false, error: { code: 'MISSING_RATE', message: 'rate is required' } });

      const db = getDatabase();
      const service = new StarsP2PService(db);

      let result: any;
      if (type === 'sell') {
        if (!starsAmount) return res.status(400).json({ success: false, error: { code: 'MISSING_STARS', message: 'starsAmount is required for sell orders' } });
        result = await service.createSellOrder(userId, Number(starsAmount), String(rate));
      } else {
        if (!tonAmount) return res.status(400).json({ success: false, error: { code: 'MISSING_TON', message: 'tonAmount is required for buy orders' } });
        result = await service.createBuyOrder(userId, String(tonAmount), String(rate));
      }

      res.status(201).json({ success: true, order: result });
    } catch (err) {
      next(err);
    }
  }

  static async listOpenOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type as 'sell' | 'buy' | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const db = getDatabase();
      const model = new StarsOrderModel(db);
      const orders = await model.listOpenOrders(type, limit, offset);
      const totalRow: any = await model.countOpenOrders(type);
      const total = totalRow?.total ?? 0;

      res.status(200).json({
        success: true,
        data: orders,
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const db = getDatabase();
      const model = new StarsOrderModel(db);
      const order = await model.getById(id);
      if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      res.status(200).json({ success: true, order });
    } catch (err) {
      next(err);
    }
  }

  static async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) return res.status(400).json({ success: false, error: { code: 'MISSING_USER_ID', message: 'X-User-Id header required' } });
      const { id } = req.params;
      const db = getDatabase();
      const model = new StarsOrderModel(db);
      const order = await model.getById(id);
      if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      if (order.user_id !== userId) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not order owner' } });
      await model.cancelOrder(id);
      res.status(200).json({ success: true, message: 'Order cancelled' });
    } catch (err) {
      next(err);
    }
  }
}

export default P2POrdersController;
