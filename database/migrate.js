#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_URL = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER || 'tg_user'}:${process.env.DB_PASSWORD || 'tg_pass'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'tg_payment_dev'}`;

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createClient() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  return client;
}

async function createMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  return result.rows.map(row => row.version);
}

async function recordMigration(client, version) {
  await client.query(
    'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
    [version]
  );
}

async function runMigration(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
}

async function migrateUp() {
  const client = await createClient();
  
  try {
    log('cyan', '🚀 Starting database migration...\n');
    
    await createMigrationTable(client);
    const applied = await getAppliedMigrations(client);
    
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    log('cyan', `📂 Found ${files.length} migration files\n`);
    
    let appliedCount = 0;
    for (const file of files) {
      const version = path.basename(file, '.sql');
      const filePath = path.join(migrationsDir, file);
      
      if (applied.includes(version)) {
        log('yellow', `⊙ Skipping (already applied): ${file}`);
      } else {
        log('yellow', `▸ Running: ${file}`);
        await runMigration(client, filePath);
        await recordMigration(client, version);
        log('green', `✓ Success: ${file}`);
        appliedCount++;
      }
    }
    
    console.log('');
    if (appliedCount > 0) {
      log('green', `✅ Migration complete! Applied ${appliedCount} migration(s).`);
    } else {
      log('green', '✅ Database is up to date. No migrations applied.');
    }
  } catch (error) {
    log('red', `\n✗ Migration failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function migrateStatus() {
  const client = await createClient();
  
  try {
    await createMigrationTable(client);
    const applied = await getAppliedMigrations(client);
    
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log('');
    log('cyan', '📊 Migration Status:\n');
    
    console.log('Applied migrations:');
    if (applied.length === 0) {
      console.log('  (none)');
    } else {
      applied.forEach(v => log('green', `  ✓ ${v}`));
    }
    
    console.log('\nPending migrations:');
    const pending = files.filter(f => !applied.includes(path.basename(f, '.sql')));
    if (pending.length === 0) {
      console.log('  (none)');
    } else {
      pending.forEach(f => log('yellow', `  ⊙ ${f}`));
    }
    console.log('');
  } catch (error) {
    log('red', `✗ Status check failed: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function migrateReset() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    log('red', '\n⚠️  WARNING: This will DROP ALL TABLES!');
    readline.question('Type "yes" to continue: ', async (answer) => {
      readline.close();
      
      if (answer !== 'yes') {
        console.log('Aborted.');
        resolve();
        return;
      }
      
      const client = await createClient();
      
      try {
        log('yellow', '\n🗑️  Dropping all tables...');
        
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query(`GRANT ALL ON SCHEMA public TO ${process.env.DB_USER || 'tg_user'}`);
        await client.query('GRANT ALL ON SCHEMA public TO public');
        
        log('green', '✓ Database reset complete\n');
        await client.end();
        
        log('yellow', 'Running migrations...');
        await migrateUp();
      } catch (error) {
        log('red', `✗ Reset failed: ${error.message}`);
        process.exit(1);
      }
      
      resolve();
    });
  });
}

// Main
const command = process.argv[2] || 'up';

(async () => {
  switch (command) {
    case 'up':
      await migrateUp();
      break;
    case 'status':
      await migrateStatus();
      break;
    case 'reset':
      await migrateReset();
      break;
    default:
      console.log('Usage: node database/migrate.js {up|status|reset}');
      console.log('');
      console.log('Commands:');
      console.log('  up     - Apply all pending migrations');
      console.log('  status - Show migration status');
      console.log('  reset  - Drop all tables and re-run migrations (DANGEROUS!)');
      process.exit(1);
  }
})();
