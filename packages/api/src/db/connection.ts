import { initDatabase, getDatabase } from '@tg-payment/core';

// Initialize database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev';

// Initialize the connection from core
initDatabase(DATABASE_URL);

// Export the database instance
export const db = getDatabase();

// For backwards compatibility with pg Pool
export const pool = db as any;

// Export getDatabase for use in controllers
export { getDatabase } from '@tg-payment/core';
