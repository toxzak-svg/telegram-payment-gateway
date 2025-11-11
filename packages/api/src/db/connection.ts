import { Pool, PoolConfig } from 'pg';

// Create pool configuration
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Export pool for use in services
export const pool = new Pool(poolConfig);

// Database connection wrapper for backward compatibility
export const dbConnection = {
  pool,
  
  async initialize(): Promise<void> {
    try {
      const client = await pool.connect();
      console.log('[INFO] ✅ Database connected successfully');
      client.release();
    } catch (error) {
      console.error('[ERROR] ❌ Database connection failed', error);
      throw error;
    }
  },

  async close(): Promise<void> {
    await pool.end();
    console.log('Database connection closed');
  },

  async query(text: string, params?: any[]): Promise<any> {
    return pool.query(text, params);
  },
};

export default dbConnection;
