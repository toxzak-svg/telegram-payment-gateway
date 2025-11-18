#!/usr/bin/env node

/**
 * Manual DeDust Swap Test Script
 * 
 * Usage:
 *   node test-dedust-swap.js --amount 0.1 --from TON --to USDT
 * 
 * Environment variables required:
 *   TON_WALLET_MNEMONIC
 *   TON_API_KEY
 *   DEDUST_TEST_POOL_ID (for testnet)
 */

require('dotenv').config();
const { DexAggregatorService } = require('../../dist/services/dex-aggregator.service');

async function main() {
  const args = process.argv.slice(2);
  const amount = parseFloat(args[args.indexOf('--amount') + 1] || '0.1');
  const fromToken = args[args.indexOf('--from') + 1] || 'TON';
  const toToken = args[args.indexOf('--to') + 1] || 'USDT';
  const slippage = parseFloat(args[args.indexOf('--slippage') + 1] || '0.1');

  console.log('🧪 DeDust Swap Test');
  console.log('==================');
  console.log(`Amount: ${amount} ${fromToken}`);
  console.log(`To: ${toToken}`);
  console.log(`Slippage: ${slippage * 100}%`);
  console.log('');

  // Check environment
  if (!process.env.TON_WALLET_MNEMONIC) {
    console.error('❌ TON_WALLET_MNEMONIC not set');
    process.exit(1);
  }

  if (process.env.TON_MAINNET === 'true') {
    console.warn('⚠️  WARNING: Running on MAINNET!');
    console.warn('   This will use real TON. Press Ctrl+C to cancel.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const dexService = new DexAggregatorService();

  try {
    // Step 1: Initialize wallet
    console.log('1️⃣  Initializing wallet...');
    await dexService.initializeWallet();
    console.log('✅ Wallet initialized\n');

    // Step 2: Get quote
    console.log('2️⃣  Getting quote...');
    const quote = await dexService.getDeDustQuote(fromToken, toToken, amount);
    console.log(`📊 Quote:`);
    console.log(`   Rate: ${quote.rate}`);
    console.log(`   Expected output: ${quote.outputAmount} ${toToken}`);
    console.log(`   Best pool: ${quote.bestPool.poolId}`);
    console.log(`   Fee: ${quote.bestPool.fee * 100}%`);
    console.log(`   Gas estimate: ${quote.estimatedGas} TON\n`);

    // Step 3: Calculate minimum output with slippage
    const minOutput = quote.outputAmount * (1 - slippage);
    console.log(`3️⃣  Slippage protection: ${minOutput.toFixed(4)} ${toToken} minimum\n`);

    // Step 4: Execute swap
    console.log('4️⃣  Executing swap...');
    console.log('   (This will take 30-60 seconds)\n');

    const result = await dexService.executeSwap(
      'dedust',
      quote.bestPool.poolId,
      fromToken,
      toToken,
      amount,
      minOutput
    );

    console.log('✅ Swap successful!');
    console.log(`   TX Hash: ${result.txHash}`);
    console.log(`   Output: ${result.outputAmount} ${toToken}`);
    console.log(`   Gas used: ${result.gasUsed} TON`);
    console.log(`   Slippage: ${((quote.outputAmount - result.outputAmount) / quote.outputAmount * 100).toFixed(2)}%`);
    console.log('');
    console.log(`🔍 View on explorer:`);
    const network = process.env.TON_MAINNET === 'true' ? 'tonscan.org' : 'testnet.tonscan.org';
    console.log(`   https://${network}/tx/${result.txHash}`);

  } catch (error) {
    console.error('❌ Swap failed:', error.message);
    if (error.metadata) {
      console.error('   Metadata:', error.metadata);
    }
    process.exit(1);
  }
}

main().catch(console.error);
