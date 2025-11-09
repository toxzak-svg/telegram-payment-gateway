import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import bodyParser from 'body-parser';
import { v4 as uuid } from 'uuid';
import { globalLimiter } from './middleware/ratelimit.middleware';
import { authMiddleware, verifySignature } from './middleware/auth.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { UserController } from './controllers/user.controller';
import v1Routes from './routes/v1.routes';
import config from './config';
import { logger } from './utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      apiKey?: string;
    }
  }
}

export class PaymentGatewayServer {
  private app: Express;
  private port: number;

  constructor(port: number = config.app.port) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());

    // CORS
    this.app.use(cors());

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

    // Rate limiting
    this.app.use(globalLimiter);

    // Request ID generation and logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      req.requestId = uuid();
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check (public)
    this.app.get('/api/v1/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // User registration (public - no auth required)
    this.app.post('/api/v1/users/register', (req: Request, res: Response) => {
      return UserController.register(req, res);
    });

    // All other routes protected by auth middleware
    this.app.use(authMiddleware);
    this.app.use(verifySignature);
    this.app.use('/api/v1', v1Routes);

    // 404 handler
    this.app.use(notFoundMiddleware);
  }

  private setupErrorHandling(): void {
    // Global error handler (must be last)
    this.app.use(errorMiddleware);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.app.listen(this.port, () => {
          logger.info(`🚀 Payment Gateway Server running on port ${this.port}`);
          logger.info(`📍 Environment: ${config.app.env}`);
          logger.info(`📚 API URL: ${config.app.apiUrl}`);
          resolve();
        });
      } catch (error) {
        logger.error('Failed to start server', error);
        reject(error);
      }
    });
  }

  getApp(): Express {
    return this.app;
  }
}

export default PaymentGatewayServer;
