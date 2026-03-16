import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export interface AuthUser { sub: string; username: string; isAdmin: boolean; }
export type AuthRequest = Request & { user?: AuthUser };

const activityLocks = new Map<string, number>();

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const user = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'secret') as AuthUser;
    req.user = user;
    
    // Background Activity Status update (debounced to 5 mins)
    const now = Date.now();
    const lastUpdate = activityLocks.get(user.sub) || 0;
    if (now - lastUpdate > 5 * 60 * 1000) {
      activityLocks.set(user.sub, now);
      prisma.user.update({ where: { id: user.sub }, data: { lastActiveAt: new Date() } }).catch(() => {});
    }

    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) { try { req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'secret') as AuthUser; } catch {} }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) { res.status(403).json({ error: 'Admin access required' }); return; }
  next();
}
