import { initDatabase, Database } from '../db/connection';
import StarsOrderModel, { StarsOrder, AtomicSwap } from '../models/stars-order.model';

/**
 * Simple P2P matching service for Stars <-> TON orders.
 * - Immediate-match strategy: when an order is created, attempt to find a counter-order.
 * - Background loop periodically scans open orders and attempts matches.
 */
export class StarsP2PService {
  private db: Database;
  private model: StarsOrderModel;
  private loopHandle: NodeJS.Timeout | null = null;

  constructor(connOrConnString?: Database | string) {
    if (!connOrConnString) {
      const conn = process.env.DATABASE_URL ?? '';
      if (!conn) throw new Error('DATABASE_URL is required for StarsP2PService');
      this.db = initDatabase(conn);
    } else if (typeof (connOrConnString as any).any === 'function') {
      // assume this is a pg-promise Database instance
      this.db = connOrConnString as Database;
    } else {
      this.db = initDatabase(connOrConnString as string);
    }
    this.model = new StarsOrderModel(this.db);
  }

  async createSellOrder(userId: string, starsAmount: number, rate: string) {
    const order: StarsOrder = {
      user_id: userId,
      type: 'sell',
      stars_amount: starsAmount,
      rate,
      status: 'open',
    };
    const created = await this.model.createOrder(order);
    // Try to match immediately
    await this.tryMatchOrder(created);
    return created;
  }

  async createBuyOrder(userId: string, tonAmount: string, rate: string) {
    const order: StarsOrder = {
      user_id: userId,
      type: 'buy',
      ton_amount: tonAmount,
      rate,
      status: 'open',
    };
    const created = await this.model.createOrder(order);
    // Try to match immediately and get the result
    const matchResult = await this.tryMatchOrder(created);
    
    // Return the latest state of the order
    const latestOrder = await this.model.getById(created.id);
    return latestOrder || created;
  }

  private async tryMatchOrder(order: any) {
    try {
      if (!order || !order.id) return null;
      if (order.status !== 'open') return null; // Don't match already matched/filled orders

      if (order.type === 'sell') {
        // find buy orders with rate >= sell.rate
        const candidates = await this.model.findOpenOrders('buy', undefined, order.rate, 5);
        if (candidates.length === 0) return null;
        const buyer = candidates[0];
        return await this.createSwapAndLock(order, buyer);
      } else {
        // order.type === 'buy'
        // find sell orders with rate <= buy.rate
        const candidates = await this.model.findOpenOrders('sell', order.rate, undefined, 5);
        if (candidates.length === 0) return null;
        const seller = candidates[0];
        return await this.createSwapAndLock(seller, order);
      }
    } catch (err) {
      console.error('Error trying to match order:', err);
      return null;
    }
  }

  private async createSwapAndLock(sell: any, buy: any) {
    // Mark both orders as matched (transactionally) and create atomic swap record
    return this.db.tx(async t => {
      const m = new StarsOrderModel(t as any);
      await m.markOrdersMatched(sell.id, buy.id);
      const swap: AtomicSwap = {
        sell_order_id: sell.id,
        buy_order_id: buy.id,
<<<<<<< HEAD
        status: 'pending',
        ton_amount: sell.ton_amount, // Add ton_amount to swap record
        rate: sell.rate, // Add rate to swap record
>>>>>>> f52dc83 (feat: Implement P2P Stars-TON order matching service and API endpoints)
      };
      const createdSwap = await m.createAtomicSwap(swap);
      // In a real implementation we would now coordinate escrow and TON transfer
      // For MVP mark swap as in_progress
      await t.none('UPDATE atomic_swaps SET status = $1 WHERE id = $2', ['in_progress', createdSwap.id]);
      return createdSwap;
    });
  }

  /**
   * Background matching loop: scan open sells and attempt to match against buys
   */
  startLoop(intervalMs = 5000) {
    if (this.loopHandle) return;
    this.loopHandle = setInterval(async () => {
      try {
        const sells = await this.model.listOpenOrders('sell', 20);
        for (const s of sells) {
          // attempt match for each sell
          await this.tryMatchOrder(s);
        }
      } catch (err) {
        console.error('P2P matching loop error:', err);
      }
    }, intervalMs);
  }

  stopLoop() {
    if (this.loopHandle) {
      clearInterval(this.loopHandle as NodeJS.Timeout);
      this.loopHandle = null;
    }
  }

  async executeAtomicSwap(swapId: string) {
    // Placeholder: run the settlement steps and mark swap completed
    const swap = await this.db.oneOrNone('SELECT * FROM atomic_swaps WHERE id = $1', [swapId]);
    if (!swap) throw new Error('Swap not found');
<<<<<<< HEAD
    if (swap.status === 'completed') return { success: true, alreadyCompleted: true };

    const sellOrder = await this.model.getById(swap.sell_order_id);
    const buyOrder = await this.model.getById(swap.buy_order_id);

    if (!sellOrder || !buyOrder) throw new Error('Orders not found');

    // Use amount from the swap record
    const tonAmount = parseFloat(swap.ton_amount);

    if (tonAmount <= 0) throw new Error('Invalid TON amount');

    // Get Seller's wallet address (User selling Stars, receiving TON)
    const sellerWallet = await this.db.oneOrNone('SELECT wallet_address FROM wallets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [sellOrder.user_id]);
    
    if (!sellerWallet) {
        console.error(`Seller wallet not found for user ${sellOrder.user_id}`);
        // We can't proceed without a destination address
        // In a real app, we might flag this for manual intervention
        throw new Error('Seller wallet not found');
    }

    try {
      // Initialize TON Service
      const tonService = new TonPaymentService({
          endpoint: process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
          apiKey: process.env.TON_API_KEY,
          mnemonic: process.env.TON_WALLET_MNEMONIC || '',
          workchain: process.env.TON_WORKCHAIN ? parseInt(process.env.TON_WORKCHAIN) : 0
      });
      await tonService.initializeWallet();

      // Execute Transfer
      // We assume the platform wallet holds the funds (deposited by Buyer)
      console.log(`Sending ${tonAmount} TON to ${sellerWallet.wallet_address}`);
      const txResult = await tonService.sendTon(sellerWallet.wallet_address, tonAmount, `Swap ${swapId}`);

      // Update Swap
      await this.db.none('UPDATE atomic_swaps SET status = $1, ton_tx_hash = $2 WHERE id = $3', ['completed', txResult, swapId]);
      
      // Update Orders
      await this.db.none('UPDATE stars_orders SET status = $1, completed_at = NOW() WHERE id IN ($2, $3)', ['completed', swap.sell_order_id, swap.buy_order_id]);

      console.log(`Swap ${swapId} completed successfully. Tx: ${txResult}`);
      return { success: true, txHash: txResult };
    } catch (error) {
      console.error(`Swap execution failed for ${swapId}:`, error);
      await this.db.none('UPDATE atomic_swaps SET status = $1 WHERE id = $2', ['failed', swapId]);
      throw error;
    }
>>>>>>> f52dc83 (feat: Implement P2P Stars-TON order matching service and API endpoints)
  }
}

export default StarsP2PService;
