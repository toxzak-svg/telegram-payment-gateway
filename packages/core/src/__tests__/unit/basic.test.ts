import EncryptionUtil from '../../utils/encryption.util';
import { RateAggregatorService } from '../../services/rate.aggregator';
import PaymentRepository from '../../models/payment.repository';

describe('Core basic tests', () => {
  test('EncryptionUtil encrypts and decrypts correctly', () => {
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'.slice(0,64);
    const util = new EncryptionUtil(key);
    const secret = 'my private key';
    const payload = util.encrypt(secret);
    expect(typeof payload).toBe('string');
    const decrypted = util.decrypt(payload);
    expect(decrypted).toBe(secret);
  });

  test('RateAggregatorService returns aggregated structure', async () => {
    const service = new RateAggregatorService();
    const agg = await service.getAggregatedRate('TON', 'USD');
    expect(agg).toHaveProperty('averageRate');
    expect(agg).toHaveProperty('bestRate');
    expect(agg.sourceCurrency).toBe('TON');
    expect(agg.targetCurrency).toBe('USD');
  });

  test('PaymentRepository basic operations', async () => {
    const repo = new PaymentRepository();
    await repo.clear();
    const payment = {
      id: 'p1',
      userId: 'u1',
      telegramInvoiceId: 'inv1',
      starsAmount: 100,
      status: 'received',
      telegramPaymentId: 'tg1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const created = await repo.create(payment);
    expect(created.id).toBe('p1');

    const found = await repo.findById('p1');
    expect(found).not.toBeNull();

    const list = await repo.findByUserId('u1');
    expect(list.length).toBe(1);
  });
});
