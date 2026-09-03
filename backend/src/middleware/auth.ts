import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { getCache, setCache } from '../utils/cache';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ id: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Route guard: allows the request through only if the authenticated user's role
 * is one of `roles`. Must run after `authenticateToken`.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

type AuthSnapshot = { id: string; role: string; accountStatus: string };

/**
 * Resolve the live account behind a token's user id. Cached briefly under the
 * `auth:me:<id>` key that the staff / rider mutations already invalidate
 * (staff.controller, admin.controller.updateUserStatus, ...), so a suspension or
 * role change takes effect within a few seconds — immediately on the paths that
 * call delCache.
 */
async function loadAccount(userId: string): Promise<AuthSnapshot | null> {
  if (!userId) return null;
  const cacheKey = `auth:me:${userId}`;

  const cached = await getCache<AuthSnapshot>(cacheKey);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, accountStatus: true },
  });
  if (!user) return null;

  await setCache(cacheKey, user, 60);
  return user;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }

    const account = await loadAccount(decoded.id);
    if (!account) {
      return res.status(403).json({ error: 'Account no longer exists' });
    }
    if (account.accountStatus !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Role is read from the DB, not the token, so a role change or a revoke
    // takes effect on the next request rather than after the 15-minute TTL.
    req.user = { id: account.id, role: account.role };
    next();
  } catch (err) {
    console.error('authenticateToken:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
