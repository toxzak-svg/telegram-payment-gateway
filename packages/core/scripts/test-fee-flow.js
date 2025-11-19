#!/usr/bin/env node
/**
 * Test Fee Collection Flow End-to-End
 * Tests the complete fee lifecycle from payment to collection
 */

require('dotenv/config');
const { Pool } = require('pg');
const { v4: uuid } = require('uuid');

async function testFeeFlow() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  console.log('🧪 Testing Fee Collection Flow\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Check platform configuration
    console.log('1️⃣ Checking platform configuration...');
    const configResult = await pool.query(`
      SELECT 
        platform_ton_wallet,
        platform_fee_percentage,
        dex_fee_percentage,
        network_fee_percentage,
        min_fee_collection_amount
      FROM platform_config 
      WHERE is_active = true
      LIMIT 1
    `);

    if (configResult.rows.length === 0) {
      console.error('❌ No active platform configuration found');
      console.log('\nRun: npm run migrate');
      process.exit(1);
    }

    const config = configResult.rows[0];
    console.log(`✅ Platform wallet: ${config.platform_ton_wallet}`);
    console.log(`✅ Platform fee: ${(config.platform_fee_percentage * 100).toFixed(2)}%`);
    console.log(`✅ Min collection: ${config.min_fee_collection_amount} TON\n`);

    if (config.platform_ton_wallet === 'ENTER_YOUR_TON_WALLET_ADDRESS_HERE' || 
        !config.platform_ton_wallet.startsWith('EQ')) {
      console.warn('⚠️ WARNING: Platform wallet not configured properly');
      console.log('   Run: node packages/core/scripts/update-platform-wallet.js YOUR_WALLET\n');
    }

    // Step 2: Get test user
    console.log('2️⃣ Getting test user...');
    const userResult = await pool.query(`
      SELECT id, api_key, app_name 
      FROM users 
      WHERE is_active = true 
      LIMIT 1
    `);

    if (userResult.rows.length === 0) {
      console.error('❌ No active users found');
      console.log('\nRun seed data: npm run seed');
      process.exit(1);
    }

    const testUser = userResult.rows[0];
    console.log(`✅ Test user: ${testUser.app_name} (${testUser.id})\n`);

    // Step 3: Create test payment
    console.log('3️⃣ Creating test payment...');
    const paymentId = uuid();
    const starsAmount = 1000;
    
    await pool.query(`
      INSERT INTO payments (
        id,
        user_id,
        telegram_payment_id,
        stars_amount,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, 'received', NOW())
    `, [paymentId, testUser.id, 'test_' + Date.now(), starsAmount]);

    console.log(`✅ Payment created: ${starsAmount} STARS\n`);

    // Step 4: Calculate and create platform fee
    console.log('4️⃣ Creating platform fee record...');
    const feeAmountStars = starsAmount * config.platform_fee_percentage;
    const feeAmountTon = feeAmountStars * 0.013; // Approximate conversion
    const feeAmountUsd = feeAmountTon * 5.5; // Approximate TON/USD rate

    const feeResult = await pool.query(`
      INSERT INTO platform_fees (
        user_id,
        fee_percentage,
        fee_amount_stars,
        fee_amount_ton,
        fee_amount_usd,
        status,
        fee_type,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', 'platform', NOW())
      RETURNING id
    `, [
      testUser.id,
      config.platform_fee_percentage,
      feeAmountStars,
      feeAmountTon,
      feeAmountUsd
    ]);

    const feeId = feeResult.rows[0].id;
    console.log(`✅ Fee created: ${feeAmountStars.toFixed(2)} STARS`);
    console.log(`   = ${feeAmountTon.toFixed(4)} TON`);
    console.log(`   = $${feeAmountUsd.toFixed(2)} USD\n`);

    // Step 5: Check total pending fees
    console.log('5️⃣ Checking total pending fees...');
    const pendingResult = await pool.query(`
      SELECT 
        COUNT(*) as fee_count,
        SUM(fee_amount_stars) as total_stars,
        SUM(fee_amount_ton) as total_ton,
        SUM(fee_amount_usd) as total_usd
      FROM platform_fees 
      WHERE status = 'pending'
    `);

    const pending = pendingResult.rows[0];
    console.log(`✅ Total pending fees:`);
    console.log(`   ${pending.fee_count} fees`);
    console.log(`   ${parseFloat(pending.total_stars).toFixed(2)} STARS`);
    console.log(`   ${parseFloat(pending.total_ton).toFixed(4)} TON`);
    console.log(`   $${parseFloat(pending.total_usd).toFixed(2)} USD\n`);

    // Step 6: Check if ready for collection
    console.log('6️⃣ Checking collection threshold...');
    const totalTon = parseFloat(pending.total_ton);
    const minAmount = parseFloat(config.min_fee_collection_amount);

    if (totalTon >= minAmount) {
      console.log(`✅ Ready for collection! (${totalTon.toFixed(4)} >= ${minAmount} TON)`);
      console.log('\n💡 To collect fees, run:');
      console.log('   npm run worker:fees');
      console.log('   or');
      console.log('   POST /api/v1/fees/collect\n');
    } else {
      console.log(`⏸️ Below threshold (${totalTon.toFixed(4)} < ${minAmount} TON)`);
      console.log(`   Need ${(minAmount - totalTon).toFixed(4)} more TON\n`);
    }

    // Step 7: Show revenue summary
    console.log('7️⃣ Revenue summary...');
    const revenueResult = await pool.query(`
      SELECT 
        SUM(CASE WHEN status = 'pending' THEN fee_amount_ton ELSE 0 END) as pending_ton,
        SUM(CASE WHEN status = 'collected' THEN fee_amount_ton ELSE 0 END) as collected_ton,
        SUM(CASE WHEN status = 'pending' THEN fee_amount_usd ELSE 0 END) as pending_usd,
        SUM(CASE WHEN status = 'collected' THEN fee_amount_usd ELSE 0 END) as collected_usd
      FROM platform_fees
    `);

    const revenue = revenueResult.rows[0];
    console.log(`💰 Pending:   ${parseFloat(revenue.pending_ton || 0).toFixed(4)} TON ($${parseFloat(revenue.pending_usd || 0).toFixed(2)})`);
    console.log(`✅ Collected: ${parseFloat(revenue.collected_ton || 0).toFixed(4)} TON ($${parseFloat(revenue.collected_usd || 0).toFixed(2)})`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Fee flow test completed successfully!\n');

    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await pool.query('DELETE FROM platform_fees WHERE id = $1', [feeId]);
    await pool.query('DELETE FROM payments WHERE id = $1', [paymentId]);
    console.log('✅ Test data cleaned up\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testFeeFlow();
