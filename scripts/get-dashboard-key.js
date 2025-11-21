const pgp = require('pg-promise')();
const db = pgp(process.env.DATABASE_URL || 'postgresql://tg_user:tg_pass@localhost:5432/tg_payment_dev');

async function getApiKey() {
  try {
    const user = await db.oneOrNone("SELECT api_key FROM users WHERE app_name = 'Test App' LIMIT 1");
    if (user) {
      console.log(user.api_key);
    } else {
      console.log('Test user not found. Please seed the database first by running: npm run seed');
    }
  } catch (error) {
    console.error('Error fetching API key:', error);
  } finally {
    pgp.end();
  }
}

getApiKey();
