import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
