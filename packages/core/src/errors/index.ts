export class PaymentGatewayError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

export class ValidationError extends PaymentGatewayError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthenticationError extends PaymentGatewayError {
  constructor(message: string = 'Authentication failed') {
    super('AUTH_ERROR', message, 401);
  }
}

export class NotFoundError extends PaymentGatewayError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404);
  }
}

export class ExternalApiError extends PaymentGatewayError {
  constructor(service: string, message: string) {
    super('EXTERNAL_API_ERROR', `${service}: ${message}`, 502);
  }
}

export class ConversionError extends PaymentGatewayError {
  constructor(message: string, details?: Record<string, any>) {
    super('CONVERSION_ERROR', message, 400, details);
  }
}

export class RateLockExpiredError extends PaymentGatewayError {
  constructor() {
    super('RATE_LOCK_EXPIRED', 'Exchange rate lock has expired', 400);
  }
}
