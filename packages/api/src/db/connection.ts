import { initDatabase, getDatabase, initPool, getPool } from '@tg-payment/core';

// Initialize database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev';

// Initialize the connection from core
initDatabase(DATABASE_URL);
initPool(DATABASE_URL);

// Export the database instance
export const db = getDatabase();

// Export the pg pool for services relying on node-postgres
export const pool = getPool();

// Export getDatabase for use in controllers
export { getDatabase, getPool } from '@tg-payment/core';
