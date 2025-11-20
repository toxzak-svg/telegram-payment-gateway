const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

// Mock Telegram payment webhook
function createMockPayment(userId, stars) {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: Math.floor(Math.random() * 10000),
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
        total_amount: stars,
        invoice_payload: 'test-payload',
        telegram_payment_charge_id: `tg_charge_${Date.now()}_${Math.random()}`,
        provider_payment_charge_id: `provider_${Date.now()}`,
      },
    },
  };
}

async function testConversionFlow() {
  console.log('🧪 Testing Complete Conversion Flow\n');
  console.log('═══════════════════════════════════════\n');

  let userId, paymentId1, paymentId2;

  try {
    // 1. Create test user
    console.log('1️⃣  Creating test user...');
    const userResponse = await axios.post(`${API_URL}/users/register`, {
      appName: 'Conversion Test App',
      description: 'Testing conversion flow',
    });
    userId = userResponse.data.user.id;
    console.log('✅ User created:', userId);
    console.log('   API Key:', userResponse.data.user.apiKey);

    // 2. Create two test payments (total 2500 stars)
    console.log('\n2️⃣  Creating test payments...');
    
    const payment1 = await axios.post(
      `${API_URL}/payments/webhook`,
      createMockPayment(userId, 1500),
      { headers: { 'X-User-Id': userId } }
    );
    paymentId1 = payment1.data.paymentId;
    console.log('✅ Payment 1:', paymentId1, '(1500 stars)');

    const payment2 = await axios.post(
      `${API_URL}/payments/webhook`,
      createMockPayment(userId, 1000),
      { headers: { 'X-User-Id': userId } }
    );
    paymentId2 = payment2.data.paymentId;
    console.log('✅ Payment 2:', paymentId2, '(1000 stars)');

    // 3. Get conversion estimate
    console.log('\n3️⃣  Getting conversion estimate...');
    const estimateResponse = await axios.post(`${API_URL}/conversions/estimate`, {
      sourceAmount: 2500,
      sourceCurrency: 'STARS',
      targetCurrency: 'TON',
    });
    console.log('✅ Quote received:');
    console.log('   Source:', estimateResponse.data.quote.sourceAmount, 'STARS');
    console.log('   Target:', estimateResponse.data.quote.targetAmount, 'TON');
    console.log('   Rate:', estimateResponse.data.quote.exchangeRate);
    console.log('   Fees:', JSON.stringify(estimateResponse.data.quote.fees, null, 2));
    console.log('   Valid until:', estimateResponse.data.quote.validUntil);

    // 4. Lock conversion rate
    console.log('\n4️⃣  Locking conversion rate...');
    const lockResponse = await axios.post(
      `${API_URL}/conversions/lock-rate`,
      {
        sourceAmount: 2500,
        sourceCurrency: 'STARS',
        targetCurrency: 'TON',
        durationSeconds: 300,
      },
      { headers: { 'X-User-Id': userId } }
    );
    console.log('✅ Rate locked:');
    console.log('   Conversion ID:', lockResponse.data.data.conversionId);
    console.log('   Locked Rate:', lockResponse.data.data.rate);
    console.log('   Locked Until:', lockResponse.data.data.lockedUntil);
    console.log('   Target Amount:', lockResponse.data.data.targetAmount, 'TON');

    // 5. Create actual conversion
    console.log('\n5️⃣  Creating conversion...');
    const conversionResponse = await axios.post(
      `${API_URL}/conversions/create`,
      {
        paymentIds: [paymentId1, paymentId2],
        targetCurrency: 'TON',
      },
      { headers: { 'X-User-Id': userId } }
    );
    const conversionId = conversionResponse.data.conversion.id;
    console.log('✅ Conversion created:');
    console.log('   ID:', conversionId);
    console.log('   Source:', conversionResponse.data.conversion.sourceAmount, 'STARS');
    console.log('   Target:', conversionResponse.data.conversion.targetAmount, 'TON');
    console.log('   Status:', conversionResponse.data.conversion.status);

    // 6. Check conversion status
    console.log('\n6️⃣  Checking conversion status...');
    const statusResponse = await axios.get(
      `${API_URL}/conversions/${conversionId}/status`
    );
    console.log('✅ Status:', statusResponse.data.conversion.status);
    console.log('   DEX TX:', statusResponse.data.conversion.dexTxHash || 'pending');
    console.log('   TON TX:', statusResponse.data.conversion.tonTxHash || 'pending');

    // 7. List all conversions
    console.log('\n7️⃣  Listing user conversions...');
    const listResponse = await axios.get(`${API_URL}/conversions`, {
      headers: { 'X-User-Id': userId },
    });
    console.log('✅ Total conversions:', listResponse.data.data.length);
    listResponse.data.data.forEach((conv, idx) => {
      console.log(`   ${idx + 1}. ${conv.id} - ${conv.status} - ${conv.source_amount} STARS → ${conv.target_amount} TON`);
    });

    // 8. Check updated payment stats
    console.log('\n8️⃣  Checking payment stats...');
    const statsResponse = await axios.get(`${API_URL}/payments/stats`, {
      headers: { 'X-User-Id': userId },
    });
    console.log('✅ Payment stats:');
    console.log('   Total Payments:', statsResponse.data.stats.totalPayments);
    console.log('   Total Stars:', statsResponse.data.stats.totalStars);
    console.log('   Successful:', statsResponse.data.stats.successfulPayments);

    console.log('\n═══════════════════════════════════════');
    console.log('🎉 ALL CONVERSION TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  - Created user with API keys');
    console.log('  - Processed 2 payments (2500 stars total)');
    console.log('  - Got conversion estimate');
    console.log('  - Locked conversion rate');
    console.log('  - Created and tracked conversion');
    console.log('  - Verified all endpoints working\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testConversionFlow();
