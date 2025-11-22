const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

async function runSeeds() {
  console.log('DATABASE_URL from seed script:', process.env.DATABASE_URL);
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const seedsDir = path.join(__dirname, '../../../database/seeds');
    const files = fs.readdirSync(seedsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Running seed: ${file}`);
        const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
        await client.query(sql);
        console.log(`✓ ${file} completed`);
      }
    }

    console.log('All seeds completed successfully');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSeeds();
