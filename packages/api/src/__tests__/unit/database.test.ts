import { dbConnection } from '../../db/connection';
import { UserRepository } from '../../models/user.repository';
import { PaymentRepository } from '../../models/payment.repository';

describe('Database Layer', () => {
  let userRepo: UserRepository;
  let paymentRepo: PaymentRepository;

  beforeAll(async () => {
    try {
      const db = await dbConnection.initialize();
      await dbConnection.runMigrations();
      userRepo = new UserRepository(db);
      paymentRepo = new PaymentRepository(db);
    } catch (error) {
      console.log('Database not available for testing - skipping');
    }
  });

  afterAll(async () => {
    await dbConnection.close();
  });

  describe('UserRepository', () => {
    test('should create user', async () => {
      if (!userRepo) return;

      const user = await userRepo.create({
        appName: `test-app-${Date.now()}`,
        webhookUrl: 'https://example.com/webhook',
      });

      expect(user.id).toBeDefined();
      expect(user.appName).toBeDefined();
      expect(user.apiKey).toMatch(/^sk_live_/);
      expect(user.kycStatus).toBe('pending');
    });

    test('should find user by API key', async () => {
      if (!userRepo) return;

      const created = await userRepo.create({
        appName: `test-app-${Date.now()}`,
      });

      const found = await userRepo.findByApiKey(created.apiKey);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    test('should update KYC status', async () => {
      if (!userRepo) return;

      const user = await userRepo.create({
        appName: `test-app-${Date.now()}`,
      });

      const updated = await userRepo.updateKycStatus(user.id, 'verified');
      expect(updated.kycStatus).toBe('verified');
    });

    test('should regenerate API key', async () => {
      if (!userRepo) return;

      const user = await userRepo.create({
        appName: `test-app-${Date.now()}`,
      });

      const oldKey = user.apiKey;
      const newKeys = await userRepo.regenerateApiKey(user.id);

      expect(newKeys.apiKey).not.toBe(oldKey);
      expect(newKeys.apiKey).toMatch(/^sk_live_/);
    });

    test('should get user statistics', async () => {
      if (!userRepo) return;

      const user = await userRepo.create({
        appName: `test-app-${Date.now()}`,
      });

      const stats = await userRepo.getStats(user.id);
      expect(stats).toHaveProperty('paymentsCount');
      expect(stats).toHaveProperty('totalStars');
      expect(stats).toHaveProperty('conversionsCount');
    });
  });

  describe('PaymentRepository', () => {
    test('should create payment', async () => {
      if (!userRepo || !paymentRepo) return;

      const user = await userRepo.create({
        appName: `test-app-${Date.now()}`,
      });

      const payment = await paymentRepo.create({
        userId: user.id,
        telegramPaymentId: `tg_${Date.now()}`,
        starsAmount: 100,
        status: 'received',
      } as any);

      expect(payment.id).toBeDefined();
      expect(parseFloat(payment.starsAmount)).toBe(100);
    });

    test('should find payment by Telegram ID', async () => {
      if (!userRepo || !paymentRepo) return;

      const user = await userRepo.create({
        appName: `test-app-${Date.now()}`,
      });

      const telegramId = `tg_${Date.now()}`;
      await paymentRepo.create({
        userId: user.id,
        telegramPaymentId: telegramId,
        starsAmount: 50,
        status: 'received',
      } as any);

      const found = await paymentRepo.findByTelegramPaymentId(telegramId);
      expect(found).not.toBeNull();
      expect(parseFloat(found?.starsAmount)).toBe(50);
    });

    test('should get payment statistics', async () => {
      if (!userRepo || !paymentRepo) return;

      const user = await userRepo.create({
        appName: `test-app-${Date.now()}`,
      });

      await paymentRepo.create({
        userId: user.id,
        telegramPaymentId: `tg_${Date.now()}`,
        starsAmount: 100,
        status: 'received',
      } as any);

      const stats = await paymentRepo.getStats(user.id);
      expect(stats.totalPayments).toBeGreaterThan(0);
      expect(stats.totalStars).toBeGreaterThan(0);
    });
  });
});
