#!/usr/bin/env node

/**
 * Check TON Wallet Balance Script
 * 
 * Usage:
 *   node check-wallet-balance.js
 */

require('dotenv').config();
const { TonClient, WalletContractV4, fromNano } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');

async function main() {
  console.log('💰 TON Wallet Balance Checker');
  console.log('==============================\n');

  // Check environment
  if (!process.env.TON_WALLET_MNEMONIC) {
    console.error('❌ TON_WALLET_MNEMONIC not set in .env');
    process.exit(1);
  }

  const isMainnet = process.env.TON_MAINNET === 'true';
  const network = isMainnet ? 'mainnet' : 'testnet';
  console.log(`🌐 Network: ${network}\n`);

  try {
    // Initialize client
    const endpoint = process.env.TON_API_URL || 
      (isMainnet ? 'https://toncenter.com/api/v2/jsonRPC' : 'https://testnet.toncenter.com/api/v2/jsonRPC');
    
    const client = new TonClient({
      endpoint,
      apiKey: process.env.TON_API_KEY,
    });

    // Get wallet from mnemonic
    const mnemonic = process.env.TON_WALLET_MNEMONIC.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    });

    console.log(`📍 Address: ${wallet.address.toString()}\n`);

    // Get balance
    const balance = await client.getBalance(wallet.address);
    const balanceTon = fromNano(balance);

    console.log(`💎 Balance: ${balanceTon} TON`);

    // Get account state
    const state = await client.getContractState(wallet.address);
    console.log(`📊 Account state: ${state.state}`);

    // Check if enough for swaps
    const minForSwap = 0.2; // 0.1 for swap + 0.1 for gas
    if (parseFloat(balanceTon) < minForSwap) {
      console.log(`\n⚠️  Balance too low for swaps (need at least ${minForSwap} TON)`);
      
      if (!isMainnet) {
        console.log('\n💡 Get testnet TON from faucet:');
        console.log('   https://t.me/testgiver_ton_bot');
        console.log(`   Send: /request ${wallet.address.toString()}`);
      }
    } else {
      console.log(`\n✅ Balance sufficient for ${Math.floor(parseFloat(balanceTon) / minForSwap)} swaps`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
