import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Add unique request ID to each request for tracking
 */
export function addRequestId(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || uuid();
  
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  
  next();
}

export default addRequestId;
