import { Request, Response, NextFunction } from 'express';

export class WebhookController {
  static async handleTonTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      // For now, we just acknowledge the webhook.
      // In the future, we will add logic to handle the transaction.
      console.log('Received TON transaction webhook:', req.body);
      res.status(200).json({ success: true, message: 'Webhook received' });
    } catch (error) {
      next(error);
    }
  }
}
