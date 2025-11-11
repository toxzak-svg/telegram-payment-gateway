import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

/**
 * Rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, message } = options;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip || 'anonymous';
    const key = `${userId}:${req.path}`;
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    // Increment request count
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: message || 'Too many requests, please try again later',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
      });
      return;
    }

    next();
  };
}

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export default rateLimit;
