import { IDatabase } from 'pg-promise';
import { Logger } from '../utils/logger.util';

export interface StarsOrder {
  id: string;
  user_id: string;
  type: 'sell' | 'buy';
  stars_amount: number;
  ton_amount: number;
  rate: number;
  status: 'open' | 'matched' | 'locked' | 'completed' | 'failed' | 'cancelled';
  locked_until?: number;
  counter_order_id?: string;
  created_at: Date;
  completed_at?: Date;
  telegram_escrow_tx?: string;
  ton_wallet_tx?: string;
}

export class StarsP2PService {
  private logger: Logger;

  constructor(private db: IDatabase<any>) {
    this.logger = new Logger('StarsP2PService');
  }

  async createSellOrder(userId: string, starsAmount: number, rate: number): Promise<StarsOrder> {
    const tonAmount = starsAmount * rate;
    
    try {
      const order = await this.db.one(
        `INSERT INTO stars_orders (user_id, type, stars_amount, ton_amount, rate, status)
         VALUES ($1, 'sell', $2, $3, $4, 'open')
         RETURNING *`,
        [userId, starsAmount, tonAmount, rate]
      );
      
      this.logger.info(`Sell order created: ${order.id}`, { userId, starsAmount, rate });
      return order;
    } catch (error) {
      this.logger.error('Failed to create sell order', error);
      throw error;
    }
  }

  async createBuyOrder(userId: string, tonAmount: number, maxRate: number): Promise<StarsOrder> {
    const starsAmount = tonAmount / maxRate;
    
    try {
      const order = await this.db.one(
        `INSERT INTO stars_orders (user_id, type, stars_amount, ton_amount, rate, status)
         VALUES ($1, 'buy', $2, $3, $4, 'open')
         RETURNING *`,
        [userId, starsAmount, tonAmount, maxRate]
      );
      
      this.logger.info(`Buy order created: ${order.id}`, { userId, tonAmount, maxRate });
      return order;
    } catch (error) {
      this.logger.error('Failed to create buy order', error);
      throw error;
    }
  }

  async matchOrders(): Promise<number> {
    try {
      const sellOrders = await this.db.manyOrNone(
        `SELECT * FROM stars_orders 
         WHERE status = 'open' AND type = 'sell'
         ORDER BY rate ASC, created_at ASC
         LIMIT 100`
      );

      const buyOrders = await this.db.manyOrNone(
        `SELECT * FROM stars_orders 
         WHERE status = 'open' AND type = 'buy'
         ORDER BY rate DESC, created_at ASC
         LIMIT 100`
      );

      let matchesCount = 0;

      for (const sell of sellOrders) {
        for (const buy of buyOrders) {
          if (buy.rate >= sell.rate && buy.stars_amount >= sell.stars_amount) {
            await this.executeMatch(sell, buy);
            matchesCount++;
            break;
          }
        }
      }

      if (matchesCount > 0) {
        this.logger.info(`Matched ${matchesCount} orders`);
      }

      return matchesCount;
    } catch (error) {
      this.logger.error('Failed to match orders', error);
      throw error;
    }
  }

  private async executeMatch(sellOrder: StarsOrder, buyOrder: StarsOrder): Promise<void> {
    await this.db.tx(async (t) => {
      await t.none(
        `UPDATE stars_orders SET status = 'matched', counter_order_id = $1 WHERE id = $2`,
        [buyOrder.id, sellOrder.id]
      );

      await t.none(
        `UPDATE stars_orders SET status = 'matched', counter_order_id = $1 WHERE id = $2`,
        [sellOrder.id, buyOrder.id]
      );

      await t.none(
        `INSERT INTO atomic_swaps (sell_order_id, buy_order_id, status)
         VALUES ($1, $2, 'pending')`,
        [sellOrder.id, buyOrder.id]
      );

      this.logger.info('Orders matched', { sellOrderId: sellOrder.id, buyOrderId: buyOrder.id });
    });
  }

  async getOpenOrders(type?: 'buy' | 'sell'): Promise<StarsOrder[]> {
    let query = `SELECT * FROM stars_orders WHERE status = 'open'`;
    if (type) query += ` AND type = '${type}'`;
    query += ` ORDER BY created_at DESC LIMIT 50`;
    return this.db.manyOrNone(query);
  }

  async getOrderById(orderId: string): Promise<StarsOrder | null> {
    return this.db.oneOrNone(`SELECT * FROM stars_orders WHERE id = $1`, [orderId]);
  }
}
