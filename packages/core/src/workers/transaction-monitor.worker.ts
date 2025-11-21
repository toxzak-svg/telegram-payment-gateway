import 'dotenv/config';
import { initDatabase } from '../db/connection';
import TonBlockchainService from '../services/ton-blockchain.service';
import TransactionMonitorService from '../services/transaction-monitor.service';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to start background workers');
  }

  const db = initDatabase(process.env.DATABASE_URL);

  const tonService = new TonBlockchainService(
    process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
    process.env.TON_API_KEY,
    process.env.TON_WALLET_MNEMONIC
  );

  // Initialize wallet for polling
  await tonService.initializeWallet().catch(err => 
    console.warn('⚠️ Failed to initialize wallet for polling:', err.message)
  );

  const transactionMonitor = new TransactionMonitorService(db, tonService);

  await transactionMonitor.start();

  const shutdown = async () => {
    console.log('\n🛑 Shutting down transaction monitor worker...');
    await transactionMonitor.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start transaction monitor worker:', err);
  process.exit(1);
});
