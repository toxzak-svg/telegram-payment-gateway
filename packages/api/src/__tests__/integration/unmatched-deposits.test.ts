import request from 'supertest';
import { buildTestApp } from './app.test-setup';
import { cleanDatabase, disconnectDatabase } from './db-test-utils';
import { getDatabase } from '@tg-payment/core';

describe('Unmatched Deposits', () => {
  const app = buildTestApp();

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  test('it should handle an unexpected deposit', async () => {
    // This test will simulate an incoming TON transaction that does not match any pending deposit.
    // The system should gracefully handle this and, ideally, notify the user.

    // For now, we will just check that the system does not crash and returns a 200 OK.
    // In the future, we will implement a notification system and test for that.

    const payload = {
      // This payload will simulate a webhook from a TON scanner indicating a new transaction.
      // The format of this payload will depend on the TON scanner service we use.
      // For now, we'll use a simplified format.
      tx_hash: 'unmatched_tx_hash',
      sender: 'some_ton_address',
      amount: '1000000000', // 1 TON in nanotons
      destination: 'our_custodial_wallet_address'
    };

    const res = await request(app)
      .post('/api/v1/webhooks/ton-transaction')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Webhook received');
  });
});
