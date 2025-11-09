import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { PaymentGatewayError, ValidationError } from '@tg-payment/core';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId?: string;
  timestamp: string;
}

/**
 * Global error handling middleware
 */
export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req as any).requestId || 'unknown';
  const timestamp = new Date().toISOString();

  logger.error(`Error: ${error.message}`, {
    requestId,
    path: req.path,
    method: req.method,
    error: error.stack,
  });

  // Handle PaymentGatewayError
  if (error instanceof PaymentGatewayError) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      requestId,
      timestamp,
    };

    return res.status(error.statusCode).json(errorResponse);
  }

  // Handle ValidationError
  if (error instanceof ValidationError) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
      },
      requestId,
      timestamp,
    };

    return res.status(400).json(errorResponse);
  }

  // Default error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    requestId,
    timestamp,
  };

  res.status(500).json(errorResponse);
};

/**
 * 404 Not Found middleware
 */
export const notFoundMiddleware = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.path} not found`,
    },
    requestId: (req as any).requestId,
    timestamp: new Date().toISOString(),
  });
};
