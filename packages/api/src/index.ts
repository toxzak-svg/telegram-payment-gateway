import dotenv from 'dotenv';
import path from 'path';

// Load .env FIRST before anything else
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import PaymentGatewayServer from './server';
import { dbConnection } from './db/connection';
import { logger } from './utils/logger';

async function main() {
  try {
    // Initialize database
    logger.info('🔄 Initializing database connection...');
    await dbConnection.initialize();

    // Run migrations
    await dbConnection.runMigrations();

    // Start API server
    logger.info('🚀 Starting payment gateway server...');
    const server = new PaymentGatewayServer();
    await server.start();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await dbConnection.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await dbConnection.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  }
}

main();
