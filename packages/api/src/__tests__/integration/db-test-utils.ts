import { getDatabase } from '@tg-payment/core';

export async function cleanDatabase() {
  const db = getDatabase();
  if (!db) {
    console.warn('Database connection not available for cleaning.');
    return;
  }
  try {
    await db.none('TRUNCATE TABLE users, wallets, payments, manual_deposits, conversions, atomic_swaps, platform_fees RESTART IDENTITY CASCADE;');
  } catch (error) {
    console.error('Error cleaning database:', error);
    // Rethrow or handle as needed. For tests, we might want to fail fast.
    throw error;
  }
}

export async function disconnectDatabase() {
    const db = getDatabase();
    if (db) {
        await db.$pool.end();
    }
}
