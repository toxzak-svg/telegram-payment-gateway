import { ExtendedDatabase } from '../db/connection';
import { logger } from '../utils/logger';

// Type definitions
interface Payment {
  id: string;
  userId: string;
  telegramPaymentId: string;
  starsAmount: number;
  status: 'pending' | 'completed' | 'failed';
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PaymentRepository {
  constructor(private db: ExtendedDatabase) {}

  /**
   * Create payment record
   */
  async create(payment: Payment & { userId: string }): Promise<any> {
    try {
      const record = await this.db.one(
        `INSERT INTO payments (user_id, telegram_payment_id, stars_amount, status, raw_payload)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id AS "userId", telegram_payment_id AS "telegramPaymentId",
                   stars_amount AS "starsAmount", status, raw_payload AS "rawPayload",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [payment.userId, payment.telegramPaymentId, payment.starsAmount, payment.status, payment.rawPayload || null]
      );
      return record;
    } catch (error: any) {
      if (error.message.includes('unique')) {
        throw new ValidationError('Payment already exists');
      }
      throw error;
    }
  }

  /**
   * Find by Telegram payment ID
   */
  async findByTelegramPaymentId(telegramId: string): Promise<any | null> {
    return this.db.oneOrNone(
      `SELECT id, user_id AS "userId", telegram_payment_id AS "telegramPaymentId",
              stars_amount AS "starsAmount", status, raw_payload AS "rawPayload",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payments WHERE telegram_payment_id = $1`,
      [telegramId]
    );
  }

  /**
   * Find by payment ID
   */
  async findById(id: string): Promise<any | null> {
    return this.db.oneOrNone(
      `SELECT id, user_id AS "userId", telegram_payment_id AS "telegramPaymentId",
              stars_amount AS "starsAmount", status, raw_payload AS "rawPayload",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payments WHERE id = $1`,
      [id]
    );
  }

  /**
   * Find payments by user ID
   */
  async findByUserId(userId: string, limit = 100, offset = 0): Promise<any[]> {
    return this.db.manyOrNone(
      `SELECT id, user_id AS "userId", telegram_payment_id AS "telegramPaymentId",
              stars_amount AS "starsAmount", status, raw_payload AS "rawPayload",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payments WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }

  /**
   * Get payment statistics for user
   */
  async getStatistics(userId: string): Promise<any> {
    return this.db.one(
      `SELECT
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        SUM(CASE WHEN status = 'completed' THEN stars_amount ELSE 0 END) as total_stars,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
       FROM payments WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Update payment status
   */
  async updateStatus(id: string, status: string): Promise<any> {
    return this.db.one(
      `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, user_id AS "userId", telegram_payment_id AS "telegramPaymentId",
                 stars_amount AS "starsAmount", status, created_at AS "createdAt"`,
      [status, id]
    );
  }
}
