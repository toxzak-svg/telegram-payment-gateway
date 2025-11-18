import { createServer } from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import routes from '../../routes/v1.routes';

export function buildTestApp() {
  const app = express();
  app.use(bodyParser.json());
  app.use('/api/v1', routes);
  return app;
}
