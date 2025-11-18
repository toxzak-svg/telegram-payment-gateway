import pgPromise from 'pg-promise';
import { Pool } from 'pg';

const pgp = pgPromise();

export type Database = pgPromise.IDatabase<any>;

let db: Database | null = null;
let pool: Pool | null = null;

export function initDatabase(connectionString: string): Database {
  if (db) {
    return db;
  }

  db = pgp({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // FIXED: Non-null assertion since we just assigned it
  return db!;
}

export function initPool(connectionString: string): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Pool not initialized. Call initPool() first.');
  }
  return pool;
}

export function closeDatabase(): void {
  if (db) {
    pgp.end();
    db = null;
  }
  if (pool) {
    pool.end();
    pool = null;
  }
}
