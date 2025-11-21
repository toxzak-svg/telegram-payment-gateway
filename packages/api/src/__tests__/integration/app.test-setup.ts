import express from 'express';
import bodyParser from 'body-parser';
import routes from '../../routes/v1.routes';
import { initDatabase, initPool } from '@tg-payment/core';

export function buildTestApp() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in the test environment');
  }
  initDatabase(DATABASE_URL);
  initPool(DATABASE_URL);

  const app = express();
  app.use(bodyParser.json());
  app.use('/api/v1', routes);
  return app;
}
