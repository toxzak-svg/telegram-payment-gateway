import 'dotenv/config';
import { initDatabase } from '../db/connection';
import TonBlockchainService from '../services/ton-blockchain.service';
import DepositMonitorService from '../services/deposit-monitor.service';
import SettlementService from '../services/settlement.service';
import { Pool } from 'pg';
import { WebhookService } from '../services/webhook.service';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to start background workers');
  }

  const db = initDatabase(process.env.DATABASE_URL);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const tonService = new TonBlockchainService(
    process.env.TON_API_URL || 'https://toncenter.com/api/v2/jsonRPC',
    process.env.TON_API_KEY,
    process.env.TON_WALLET_MNEMONIC
  );

  const webhookService = process.env.WEBHOOK_SECRET
    ? new WebhookService(pool, process.env.WEBHOOK_SECRET)
    : undefined;

  const depositMonitor = new DepositMonitorService(db, tonService, webhookService);
  const settlementService = new SettlementService(db, webhookService);

  await depositMonitor.start();
  await settlementService.start();

  const shutdown = async () => {
    console.log('\n🛑 Shutting down deposit/settlement workers...');
    await depositMonitor.stop();
    await settlementService.stop();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start deposit/settlement worker:', err);
  process.exit(1);
});
