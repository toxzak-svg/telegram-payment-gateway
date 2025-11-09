import request from 'supertest';
import PaymentGatewayServer from '../../server';

describe('Payment Gateway API', () => {
  let server: PaymentGatewayServer;

  beforeAll(() => {
    server = new PaymentGatewayServer(3001);
  });

  describe('Health Endpoint', () => {
    test('GET /api/v1/health should return 200', async () => {
      const response = await request(server.getApp())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Rates Endpoint', () => {
    test('GET /api/v1/rates should return exchange rates', async () => {
      const response = await request(server.getApp())
        .get('/api/v1/rates')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Payment Endpoints', () => {
    test('GET /api/v1/payments requires authentication', async () => {
      const response = await request(server.getApp())
        .get('/api/v1/payments')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_API_KEY');
    });

    test('GET /api/v1/payments with API key returns payments', async () => {
      const response = await request(server.getApp())
        .get('/api/v1/payments')
        .set('X-API-Key', 'test-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payments');
    });
  });

  describe('Conversion Endpoints', () => {
    test('POST /api/v1/conversions/estimate should calculate fees', async () => {
      const response = await request(server.getApp())
        .post('/api/v1/conversions/estimate')
        .set('X-API-Key', 'test-key')
        .send({
          starsAmount: 1000,
          targetCurrency: 'TON',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('estimatedTarget');
      expect(response.body.data).toHaveProperty('fees');
    });
  });

  describe('404 Handling', () => {
    test('Unknown route should return 404', async () => {
  const response = await request(server.getApp())
    .get('/api/v1/unknown-route')
    .set('X-API-Key', 'test-key')  // Add API key so auth middleware passes
    .expect(404);

  expect(response.body.success).toBe(false);
  expect(response.body.error.code).toBe('NOT_FOUND');
});
  });
});
