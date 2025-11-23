const pgp = require('pg-promise')();
const crypto = require('crypto');

const DB_URL = process.env.DATABASE_URL || 'postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev';
const db = pgp(DB_URL);

function generateApiKey() {
  return 'pk_' + crypto.randomBytes(18).toString('hex');
}

function generateApiSecret() {
  return 'sk_' + crypto.randomBytes(24).toString('hex');
}

async function createDashboardUser() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();
    try {
      const row = await db.one(
        `INSERT INTO users (id, api_key, api_secret, app_name, kyc_status, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
         RETURNING id, api_key`,
        [apiKey, apiSecret, 'Dashboard', 'verified']
      );

      console.log('API key generated and stored successfully.');
      console.log('API Key:', row.api_key);
      console.log('NOTE: The secret is stored in `api_secret` column.');
      return;
    } catch (err) {
      // Unique violation -> retry; otherwise fail
      if (err && err.code === '23505') {
        // duplicate key, try again
        continue;
      }
      console.error('Failed to insert API key:', err.message || err);
      process.exit(1);
    }
  }

  console.error('Failed to generate a unique API key after several attempts.');
  process.exit(1);
}

createDashboardUser()
  .catch((err) => {
    console.error('Unexpected error:', err);
  })
  .finally(() => pgp.end());
