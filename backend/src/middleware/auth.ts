import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    next();
  });
}
