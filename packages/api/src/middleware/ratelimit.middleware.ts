import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

/**
 * Create configurable rate limiter
 */
function createRateLimiter(options?: {
  windowMs?: number;
  maxRequests?: number;
}): RateLimitRequestHandler {
  const { windowMs = 60000, maxRequests = 60 } = options || {};

  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip X-Forwarded-For validation in development
    validate: { xForwardedForHeader: false },
  });
}

// Default global rate limiter - created once
const globalLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 60
});

export default globalLimiter;
export { createRateLimiter };
