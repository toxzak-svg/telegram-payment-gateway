import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import globalLimiter from './middleware/ratelimit.middleware';
import { errorHandler } from './middleware/error.middleware';
import v1Routes from './routes/v1.routes';
import './db/connection';

export function createServer(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Global rate limiting
  app.use(globalLimiter);

  // Health check endpoint (no additional auth required)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // API routes
  app.use('/api/v1', v1Routes);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}

export default createServer;
