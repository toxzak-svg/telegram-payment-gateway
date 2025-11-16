import { Payment } from './payment.model';

/**
 * Lightweight in-memory PaymentRepository used by unit tests
 * In production this would use Database / pg-promise
 */
export class PaymentRepository {
  private store: Map<string, Payment> = new Map();

  async clear(): Promise<void> {
    this.store.clear();
  }

  async create(payment: Payment): Promise<Payment> {
    this.store.set(payment.id, payment);
    return payment;
  }

  async findById(id: string): Promise<Payment | null> {
    return this.store.get(id) || null;
  }

  async findByUserId(userId: string): Promise<Payment[]> {
    const results: Payment[] = [];
    for (const p of this.store.values()) {
      if (p.userId === userId) results.push(p);
    }
    return results;
  }

  async getStats(userId: string): Promise<{ totalPayments: number; totalStars: number; receivedCount: number }> {
    const payments = await this.findByUserId(userId);
    const totalPayments = payments.length;
    const totalStars = payments.reduce((s, p) => s + (p.starsAmount || 0), 0);
    const receivedCount = payments.filter(p => p.status === 'received').length;
    return { totalPayments, totalStars, receivedCount };
  }
}

export default PaymentRepository;
