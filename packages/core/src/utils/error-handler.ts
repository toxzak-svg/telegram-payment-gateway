export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Payment errors
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  INVALID_PAYMENT_STATUS = 'INVALID_PAYMENT_STATUS',
  PAYMENT_ALREADY_CONVERTED = 'PAYMENT_ALREADY_CONVERTED',

  // Conversion errors
  CONVERSION_NOT_FOUND = 'CONVERSION_NOT_FOUND',
  MINIMUM_AMOUNT_NOT_MET = 'MINIMUM_AMOUNT_NOT_MET',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  RATE_LOCK_EXPIRED = 'RATE_LOCK_EXPIRED',
  RATE_LOCK_NOT_FOUND = 'RATE_LOCK_NOT_FOUND',
  CONVERSION_IN_PROGRESS = 'CONVERSION_IN_PROGRESS',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',

  // Rate limit errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // External service errors
  TELEGRAM_API_ERROR = 'TELEGRAM_API_ERROR',
  DEX_API_ERROR = 'DEX_API_ERROR',
  TON_NETWORK_ERROR = 'TON_NETWORK_ERROR',
  EXCHANGE_API_ERROR = 'EXCHANGE_API_ERROR',

  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT'
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details
      }
    };
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, ErrorCode.UNAUTHORIZED, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, ErrorCode.FORBIDDEN, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, ErrorCode.NOT_FOUND, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.CONFLICT, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429, { retryAfter });
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(
      `External service error (${service}): ${message}`,
      ErrorCode.SERVICE_UNAVAILABLE,
      503,
      details
    );
  }
}

export class ConversionError extends AppError {
  constructor(message: string, code: ErrorCode, details?: any) {
    super(message, code, 400, details);
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  /**
   * Check if error is operational (expected)
   */
  static isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Log error appropriately
   */
  static logError(error: Error): void {
    if (error instanceof AppError) {
      console.error(`[${error.code}] ${error.message}`, {
        statusCode: error.statusCode,
        details: error.details,
        stack: error.stack
      });
    } else {
      console.error('Unexpected error:', error);
    }
  }

  /**
   * Format error for API response
   */
  static formatError(error: Error): {
    success: false;
    error: {
      message: string;
      code: string;
      details?: any;
    };
  } {
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        }
      };
    }

    // Handle unknown errors
    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        code: ErrorCode.INTERNAL_ERROR
      }
    };
  }

  /**
   * Get HTTP status code from error
   */
  static getStatusCode(error: Error): number {
    if (error instanceof AppError) {
      return error.statusCode;
    }
    return 500;
  }
}
