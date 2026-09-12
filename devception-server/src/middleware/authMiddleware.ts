import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User.model';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userDoc?: InstanceType<typeof User>;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  const token = header.slice(7);
  let decoded: {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
  };

  try {
    decoded = jwt.verify(token, env.NEXTAUTH_SECRET) as {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
    };
    if (!decoded.sub) throw new Error('No sub');
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findOneAndUpdate(
        { googleId: decoded.sub },
        {
          $set: {
            email: decoded.email ?? `${decoded.sub}@codecrew.dev`,
            displayName: decoded.name ?? 'Player',
            avatarUrl: decoded.picture ?? '',
          },
          $setOnInsert: {
            googleId: decoded.sub,
          },
        },
        { upsert: true, new: true }
      );
      if (user) {
        req.userId = user._id.toString();
        req.userDoc = user;
      }
    }
  } catch (err) {
    logger.warn(`[authMiddleware] DB sync error, falling back to decoded token: ${err}`);
  }

  if (!req.userId) {
    req.userId = decoded.sub;
  }
  next();
}
