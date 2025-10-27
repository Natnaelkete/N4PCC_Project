import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/auth.js';
import { getUserById } from '../utils/auth.js';
import { logger } from '../utils/logger.js';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.user = await getUserById(payload.userId);

    if (req.user.global_status === 'BANNED') {
      logger.warn('Banned user attempted access', {
        userId: req.userId,
        ipAddress: req.ip,
        action: 'ACCESS_DENIED_BANNED',
      });
      return res.status(403).json({ error: 'Access denied: Account is banned' });
    }

    next();
  } catch (error) {
    logger.error('Authentication failed', {
      ipAddress: req.ip,
      action: 'AUTH_FAILURE',
      details: { error: (error as Error).message },
    });
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.global_status !== 'ADMIN') {
    logger.security('Unauthorized admin access attempt', {
      userId: req.userId,
      ipAddress: req.ip,
      action: 'UNAUTHORIZED_ADMIN_ACCESS',
    });
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};



