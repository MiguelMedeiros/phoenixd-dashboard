import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index.js';

export interface AuthenticatedRequest extends Request {
  sessionId?: string;
}

/**
 * Middleware to check if a valid session cookie exists.
 * If password is not configured, all requests are allowed.
 * If password is configured, a valid session is required.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Check if password is configured
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    // No password configured - allow access
    if (!settings?.passwordHash) {
      return next();
    }

    // Password is configured - check for valid session
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      res.clearCookie('session');
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: sessionId } });
      res.clearCookie('session');
      return res.status(401).json({ error: 'Session expired' });
    }

    // Update last used timestamp
    await prisma.session.update({
      where: { id: sessionId },
      data: { lastUsed: new Date() },
    });

    req.sessionId = sessionId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Cleanup expired sessions - call periodically
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      console.log(`Cleaned up ${result.count} expired sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}
