#!/usr/bin/env node
/**
 * Update Platform TON Wallet Address
 * Usage: node scripts/update-platform-wallet.js <TON_WALLET_ADDRESS>
 */

require('dotenv/config');
const { Pool } = require('pg');

async function updatePlatformWallet(walletAddress) {
  if (!walletAddress) {
    console.error('❌ Error: Wallet address required');
    console.log('\nUsage: node scripts/update-platform-wallet.js <TON_WALLET_ADDRESS>');
    console.log('\nExample:');
    console.log('  node scripts/update-platform-wallet.js EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2');
    process.exit(1);
  }

  // Basic validation for TON address format
  if (!walletAddress.startsWith('EQ') && !walletAddress.startsWith('UQ')) {
    console.error('❌ Error: Invalid TON wallet address format');
    console.error('   TON addresses should start with EQ or UQ');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔧 Updating platform TON wallet address...\n');

    // Update the platform configuration
    const result = await pool.query(`
      UPDATE platform_config 
      SET platform_ton_wallet = $1,
          updated_at = NOW()
      WHERE is_active = true
      RETURNING 
        platform_ton_wallet,
        platform_fee_percentage,
        dex_fee_percentage,
        network_fee_percentage,
        min_fee_collection_amount
    `, [walletAddress]);

    if (result.rowCount === 0) {
      console.error('❌ Error: No active platform configuration found');
      console.log('\nRun database migrations first:');
      console.log('  npm run migrate');
      process.exit(1);
    }

    const config = result.rows[0];
    
    console.log('✅ Platform wallet updated successfully!\n');
    console.log('📊 Current Configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💰 Platform Wallet: ${config.platform_ton_wallet}`);
    console.log(`📈 Platform Fee:    ${(config.platform_fee_percentage * 100).toFixed(2)}%`);
    console.log(`🔄 DEX Fee:         ${(config.dex_fee_percentage * 100).toFixed(2)}%`);
    console.log(`📡 Network Fee:     ${(config.network_fee_percentage * 100).toFixed(2)}%`);
    console.log(`💵 Min Collection:  ${config.min_fee_collection_amount} TON`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 You can now start collecting fees!');
    console.log('\nNext steps:');
    console.log('  1. Start the fee collection worker:');
    console.log('     npm run worker:fees');
    console.log('  2. Or manually trigger collection via API:');
    console.log('     POST /api/v1/fees/collect');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get wallet address from command line
const walletAddress = process.argv[2];
updatePlatformWallet(walletAddress);
