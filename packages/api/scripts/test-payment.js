const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

// Generate a proper UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const testUserId = generateUUID();

// Simulated Telegram successful payment webhook
const mockPaymentWebhook = {
  update_id: 123456789,
  message: {
    message_id: 1,
    from: {
      id: 987654321,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
    },
    chat: {
      id: 987654321,
      type: 'private',
    },
    date: Math.floor(Date.now() / 1000),
    successful_payment: {
      currency: 'XTR',
      total_amount: 1000, // 1000 stars
      invoice_payload: 'test-payload',
      telegram_payment_charge_id: `tg_charge_${Date.now()}`,
      provider_payment_charge_id: `provider_${Date.now()}`,
    },
  },
};

async function testPaymentFlow() {
  console.log('🧪 Testing Payment Webhook Flow\n');

  try {
    // 0. Create a test user first
    console.log('0️⃣ Creating test user...');
    const userResponse = await axios.post(`${API_URL}/users/register`, {
      appName: 'Test Payment App',
      description: 'Automated test user',
    });

    const userId = userResponse.data.user.id;
    console.log('✅ Test user created:', userId);

    // 1. Test webhook
    console.log('\n1️⃣ Sending payment webhook...');
    const webhookResponse = await axios.post(
      `${API_URL}/payments/webhook`,
      mockPaymentWebhook,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
      }
    );

    console.log('✅ Webhook processed:', webhookResponse.data);
    const paymentId = webhookResponse.data.paymentId;

    // 2. Get payment details
    console.log('\n2️⃣ Fetching payment details...');
    const paymentResponse = await axios.get(`${API_URL}/payments/${paymentId}`);
    console.log('✅ Payment details:', paymentResponse.data.payment);

    // 3. Get user payment stats
    console.log('\n3️⃣ Fetching payment stats...');
    const statsResponse = await axios.get(`${API_URL}/payments/stats`, {
      headers: { 'X-User-Id': userId },
    });
    console.log('✅ Payment stats:', statsResponse.data.stats);

    // 4. List all payments
    console.log('\n4️⃣ Listing all payments...');
    const listResponse = await axios.get(`${API_URL}/payments`, {
      headers: { 'X-User-Id': userId },
    });
    console.log('✅ Total payments:', listResponse.data.data.length);

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
  }
}

testPaymentFlow();
