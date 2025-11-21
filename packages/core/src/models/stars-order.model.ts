import { IDatabase } from 'pg-promise';

export type StarsOrder = {
  id?: string;
  user_id: string;
  type: 'sell' | 'buy';
  stars_amount?: number | null;
  ton_amount?: string | null;
  rate: string; // numeric string
  status?: string;
  locked_until?: Date | null;
  counter_order_id?: string | null;
  created_at?: Date;
  completed_at?: Date | null;
};

export type AtomicSwap = {
  id?: string;
  sell_order_id: string;
  buy_order_id: string;
  smart_contract_address?: string | null;
  ton_tx_hash?: string | null;
  telegram_tx_id?: string | null;
  status?: string;
  created_at?: Date;
  ton_amount?: string;
  rate?: string;
};

export class StarsOrderModel {
  constructor(private db: IDatabase<any>) {}

  async createOrder(data: StarsOrder) {
    const row = await this.db.one(
      `INSERT INTO stars_orders(user_id, type, stars_amount, ton_amount, rate, status, locked_until, counter_order_id, telegram_escrow_tx, ton_wallet_tx)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        data.user_id,
        data.type,
        data.stars_amount ?? null,
        data.ton_amount ?? null,
        data.rate,
        data.status ?? 'open',
        data.locked_until ?? null,
        data.counter_order_id ?? null,
        null,
        null,
      ]
    );
    return row;
  }

  async getById(id: string) {
    return this.db.oneOrNone('SELECT * FROM stars_orders WHERE id = $1', [id]);
  }

  async findOpenOrders(oppositeType: 'sell' | 'buy', maxRate?: string, minRate?: string, limit = 10) {
    // For a buyer: oppositeType='sell' and we want sell.rate <= buyer.rate
    // For a seller: oppositeType='buy' and we want buy.rate >= seller.rate
    let query = 'SELECT * FROM stars_orders WHERE status = $1 AND type = $2';
    const params: any[] = ['open', oppositeType];
    if (maxRate !== undefined) {
      query += ' AND rate <= $' + (params.length + 1);
      params.push(maxRate);
    }
    if (minRate !== undefined) {
      query += ' AND rate >= $' + (params.length + 1);
      params.push(minRate);
    }
    query += ' ORDER BY created_at ASC LIMIT $' + (params.length + 1);
    params.push(limit);
    return this.db.any(query, params);
  }

  async updateStatus(id: string, status: string, extra: Partial<StarsOrder> = {}) {
    const fields = ['status = $2'];
    const params: any[] = [id, status];
    let idx = 3;
    if (extra.locked_until !== undefined) {
      fields.push(`locked_until = $${idx++}`);
      params.push(extra.locked_until);
    }
    if (extra.counter_order_id !== undefined) {
      fields.push(`counter_order_id = $${idx++}`);
      params.push(extra.counter_order_id);
    }
    if (extra.completed_at !== undefined) {
      fields.push(`completed_at = $${idx++}`);
      params.push(extra.completed_at);
    }
    const q = `UPDATE stars_orders SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    return this.db.one(q, params);
  }

  async createAtomicSwap(data: AtomicSwap) {
    const row = await this.db.one(
      `INSERT INTO atomic_swaps(sell_order_id, buy_order_id, smart_contract_address, ton_tx_hash, telegram_tx_id, status, ton_amount, rate)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.sell_order_id, data.buy_order_id, data.smart_contract_address ?? null, data.ton_tx_hash ?? null, data.telegram_tx_id ?? null, data.status ?? 'pending', data.ton_amount, data.rate]
    return this.db.one(
      `INSERT INTO atomic_swaps(sell_order_id, buy_order_id, smart_contract_address, ton_tx_hash, telegram_tx_id, status)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.sell_order_id, data.buy_order_id, data.smart_contract_address ?? null, data.ton_tx_hash ?? null, data.telegram_tx_id ?? null, data.status ?? 'pending']
    );
  }

  async markOrdersMatched(sellId: string, buyId: string) {
    await this.db.tx(async t => {
      await t.none('UPDATE stars_orders SET status = $1, counter_order_id = $2 WHERE id = $3', ['matched', buyId, sellId]);
      await t.none('UPDATE stars_orders SET status = $1, counter_order_id = $2 WHERE id = $3', ['matched', sellId, buyId]);
    });
  }

  async cancelOrder(id: string) {
    return this.updateStatus(id, 'cancelled', { completed_at: new Date() });
  }

  async listOpenOrders(type?: 'sell' | 'buy', limit = 50) {
    if (type) return this.db.any('SELECT * FROM stars_orders WHERE status = $1 AND type = $2 ORDER BY created_at DESC LIMIT $3', ['open', type, limit]);
    return this.db.any('SELECT * FROM stars_orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2', ['open', limit]);
  }
}

export default StarsOrderModel;
