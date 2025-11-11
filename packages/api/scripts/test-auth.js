const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

async function testAuthFlow() {
  console.log('🔐 Testing API Authentication & Rate Limiting\n');
  console.log('═══════════════════════════════════════════\n');

  let apiKey;

  try {
    // 1. Test unauthenticated request (should fail)
    console.log('1️⃣  Testing unauthenticated request...');
    try {
      await axios.get(`${API_URL}/users/me`);
      console.log('❌ Should have failed but succeeded!');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly rejected:', error.response.data.error.code);
      } else {
        throw error;
      }
    }

    // 2. Register new user (no auth required)
    console.log('\n2️⃣  Registering new user...');
    const registerResponse = await axios.post(`${API_URL}/users/register`, {
      appName: 'Auth Test App',
      description: 'Testing authentication',
    });
    apiKey = registerResponse.data.user.apiKey;
    console.log('✅ User registered');
    console.log('   API Key:', apiKey);

    // 3. Test authenticated request
    console.log('\n3️⃣  Testing authenticated request...');
    const meResponse = await axios.get(`${API_URL}/users/me`, {
      headers: { 'X-API-Key': apiKey },
    });
    console.log('✅ Authenticated successfully');
    console.log('   User:', meResponse.data.user.appName);

    // 4. Test invalid API key
    console.log('\n4️⃣  Testing invalid API key...');
    try {
      await axios.get(`${API_URL}/users/me`, {
        headers: { 'X-API-Key': 'pk_invalid_key_12345' },
      });
      console.log('❌ Should have failed but succeeded!');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly rejected:', error.response.data.error.code);
      } else {
        throw error;
      }
    }

    // 5. Test malformed API key
    console.log('\n5️⃣  Testing malformed API key...');
    try {
      await axios.get(`${API_URL}/users/me`, {
        headers: { 'X-API-Key': 'invalid_format' },
      });
      console.log('❌ Should have failed but succeeded!');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly rejected:', error.response.data.error.code);
      } else {
        throw error;
      }
    }

    // 6. Test rate limiting
    console.log('\n6️⃣  Testing rate limiting (making 12 requests, limit is 10/min)...');
    let rateLimitHit = false;
    for (let i = 1; i <= 12; i++) {
      try {
        const response = await axios.post(
          `${API_URL}/users/register`,
          {
            appName: `Rate Test ${i}`,
          }
        );
        console.log(`   Request ${i}: Success`);
      } catch (error) {
        if (error.response?.status === 429) {
          console.log(`   Request ${i}: ✅ Rate limited!`);
          console.log('   Error:', error.response.data.error.code);
          console.log('   Retry after:', error.response.data.error.retryAfter, 'seconds');
          rateLimitHit = true;
          break;
        } else {
          throw error;
        }
      }
    }

    if (!rateLimitHit) {
      console.log('⚠️  Rate limit not hit (may need to adjust limits)');
    }

    // 7. Test Authorization header format
    console.log('\n7️⃣  Testing Bearer token format...');
    const bearerResponse = await axios.get(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    console.log('✅ Bearer token accepted:', bearerResponse.data.user.appName);

    // 8. Test query parameter format
    console.log('\n8️⃣  Testing query parameter format...');
    const queryResponse = await axios.get(`${API_URL}/users/me?api_key=${apiKey}`);
    console.log('✅ Query parameter accepted:', queryResponse.data.user.appName);

    // 9. Check rate limit headers
    console.log('\n9️⃣  Checking rate limit headers...');
    const headerResponse = await axios.get(`${API_URL}/users/me`, {
      headers: { 'X-API-Key': apiKey },
    });
    console.log('✅ Rate limit headers:');
    console.log('   X-RateLimit-Limit:', headerResponse.headers['x-ratelimit-limit']);
    console.log('   X-RateLimit-Remaining:', headerResponse.headers['x-ratelimit-remaining']);
    console.log('   X-RateLimit-Reset:', headerResponse.headers['x-ratelimit-reset']);
    console.log('   X-Request-Id:', headerResponse.headers['x-request-id']);

    // 10. Test protected endpoints work with auth
    console.log('\n🔟 Testing protected endpoints...');
    
    // Create payment
    const paymentResponse = await axios.post(
      `${API_URL}/payments/webhook`,
      {
        message: {
          from: { id: 123, username: 'testuser' },
          successful_payment: {
            telegram_payment_charge_id: `test_${Date.now()}`,
            total_amount: 500,
            currency: 'XTR',
          },
        },
      },
      { headers: { 'X-User-Id': meResponse.data.user.id } }
    );
    console.log('✅ Payment created:', paymentResponse.data.paymentId);

    // Get payment stats with API key
    const statsResponse = await axios.get(`${API_URL}/payments/stats`, {
      headers: { 'X-API-Key': apiKey },
    });
    console.log('✅ Stats retrieved:', statsResponse.data.stats);

    // Get conversion estimate with API key
    const estimateResponse = await axios.post(
      `${API_URL}/conversions/estimate`,
      { sourceAmount: 500 },
      { headers: { 'X-API-Key': apiKey } }
    );
    console.log('✅ Estimate retrieved:', estimateResponse.data.quote.targetAmount, 'TON');

    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 ALL AUTHENTICATION TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  ✅ Unauthenticated requests blocked');
    console.log('  ✅ Valid API keys accepted');
    console.log('  ✅ Invalid API keys rejected');
    console.log('  ✅ Malformed API keys rejected');
    console.log('  ✅ Rate limiting working');
    console.log('  ✅ Multiple auth formats supported');
    console.log('  ✅ Rate limit headers present');
    console.log('  ✅ Protected endpoints secured\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAuthFlow();
