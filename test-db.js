require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

console.log('Attempting connection with:');
console.log('Host:', process.env.DB_HOST);
console.log('Port:', process.env.DB_PORT);
console.log('Database:', process.env.DB_NAME);
console.log('User:', process.env.DB_USER);
console.log('Password:', process.env.DB_PASSWORD);

client.connect()
  .then(() => {
    console.log('✅ Connection successful!');
    return client.query('SELECT version()');
  })
  .then(result => {
    console.log('PostgreSQL version:', result.rows[0].version);
    client.end();
  })
  .catch(err => {
    console.error('❌ Connection error:', err.message);
    client.end();
  });
