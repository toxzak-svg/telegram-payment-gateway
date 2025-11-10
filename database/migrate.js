require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Build connection string without password
const connectionString = `postgresql://${process.env.DB_USER || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'payment_gateway'}`;

console.log('🔧 Connection string:', connectionString);

const client = new Client({
  connectionString,
});

// Run migrations
async function runMigrations() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Read all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📂 Found ${files.length} migration files`);

    for (const file of files) {
      // Check if already applied
      const result = await client.query(
        'SELECT id FROM migrations WHERE filename = $1',
        [file]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      // Read and execute migration
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`🔄 Applying ${file}...`);
      await client.query(sql);

      // Record migration
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [file]
      );

      console.log(`✅ Applied ${file}`);
    }

    console.log('🎉 All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
