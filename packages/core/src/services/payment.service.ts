import { Pool } from 'pg';

export interface PaymentRecord {
  id: string;
  user_id: string;
  telegram_payment_id: string;
  user_telegram_id: number;
  user_telegram_username?: string;
  stars_amount: number;
  status: string;
  raw_payload: any;
  created_at: Date;
}

export interface TelegramPaymentPayload {
  message?: {
    successful_payment?: {
      telegram_payment_charge_id: string;
      provider_payment_charge_id?: string;
      total_amount: number;
      currency: string;
      invoice_payload?: string;
    };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
  };
  pre_checkout_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    currency: string;
    total_amount: number;
    invoice_payload?: string;
  };
}

export class PaymentService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Process successful payment from Telegram
   */
  async processSuccessfulPayment(
    userId: string,
    payload: TelegramPaymentPayload
  ): Promise<PaymentRecord> {
    const payment = payload.message?.successful_payment;
    
    if (!payment) {
      throw new Error('Invalid payment payload');
    }

    const client = await this.pool.connect();
    
    try {
      // Convert Telegram XTR (stars) to decimal amount
      // Telegram sends amount in smallest units (1 star = 1 unit)
      const starsAmount = payment.total_amount;

      const result = await client.query(
        `INSERT INTO payments (
          user_id,
          telegram_payment_id,
          provider_payment_id,
          user_telegram_id,
          user_telegram_username,
          stars_amount,
          status,
          raw_payload,
          confirmed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          userId,
          payment.telegram_payment_charge_id,
          payment.provider_payment_charge_id || null,
          payload.message?.from?.id,
          payload.message?.from?.username,
          starsAmount,
          'received',
          JSON.stringify(payload),
        ]
      );

      console.log('✅ Payment recorded:', {
        id: result.rows[0].id,
        stars: starsAmount,
        user: payload.message?.from?.username,
      });

      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to record payment:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify pre-checkout query (before payment is charged)
   */
  async verifyPreCheckout(
    userId: string,
    payload: TelegramPaymentPayload
  ): Promise<boolean> {
    const query = payload.pre_checkout_query;
    
    if (!query) {
      return false;
    }

    console.log('🔍 Pre-checkout verification:', {
      userId,
      amount: query.total_amount,
      currency: query.currency,
    });

    // Add your business logic here:
    // - Check if user is allowed to make payment
    // - Verify amount is within limits
    // - Check for fraud indicators
    
    return true;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get payments for a user
   */
  async getUserPayments(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PaymentRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM payments 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get payment statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalPayments: number;
    totalStars: number;
    successfulPayments: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(stars_amount), 0) as total_stars,
        COUNT(CASE WHEN status = 'received' THEN 1 END) as successful_payments
       FROM payments 
       WHERE user_id = $1`,
      [userId]
    );

    return {
      totalPayments: parseInt(result.rows[0].total_payments),
      totalStars: parseFloat(result.rows[0].total_stars),
      successfulPayments: parseInt(result.rows[0].successful_payments),
    };
  }
}

export default PaymentService;
