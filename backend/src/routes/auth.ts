import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import { prisma } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cookie options for security
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: SESSION_DURATION_MS,
  path: '/',
};

/**
 * GET /api/auth/status
 * Check if password is configured and if user is authenticated
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    const hasPassword = !!settings?.passwordHash;
    let authenticated = false;

    // If password is configured, check for valid session
    if (hasPassword) {
      const sessionId = req.cookies?.session;
      if (sessionId) {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
        });
        authenticated = !!session && session.expiresAt > new Date();
      }
    } else {
      // No password = always authenticated
      authenticated = true;
    }

    res.json({
      hasPassword,
      authenticated,
      autoLockMinutes: settings?.autoLockMinutes || 0,
      lockScreenBg: settings?.lockScreenBg || 'storm-clouds',
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

/**
 * POST /api/auth/setup
 * Setup initial password (only works if no password is set)
 */
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // Check if password already exists
    const existing = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (existing?.passwordHash) {
      return res
        .status(400)
        .json({ error: 'Password already configured. Use change-password instead.' });
    }

    // Hash password and save
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { passwordHash },
      create: { id: 'singleton', passwordHash },
    });

    // Create session and set cookie
    const session = await prisma.session.create({
      data: {
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      },
    });

    res.cookie('session', session.id, cookieOptions);
    res.json({ success: true, message: 'Password configured successfully' });
  } catch (error) {
    console.error('Error setting up password:', error);
    res.status(500).json({ error: 'Failed to setup password' });
  }
});

/**
 * POST /api/auth/login
 * Login with password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings?.passwordHash) {
      return res.status(400).json({ error: 'No password configured' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, settings.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      },
    });

    res.cookie('session', session.id, cookieOptions);
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies?.session;

    if (sessionId) {
      await prisma.session
        .delete({
          where: { id: sessionId },
        })
        .catch(() => {
          // Session might not exist, that's ok
        });
    }

    res.clearCookie('session', { path: '/' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (requires current password)
 */
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    // If password exists, verify current password
    if (settings?.passwordHash) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const valid = await bcrypt.compare(currentPassword, settings.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    // Hash new password and save
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { passwordHash },
      create: { id: 'singleton', passwordHash },
    });

    // Invalidate all other sessions (keep current one)
    if (req.sessionId) {
      await prisma.session.deleteMany({
        where: {
          id: { not: req.sessionId },
        },
      });
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * DELETE /api/auth/remove-password
 * Remove password protection (requires current password)
 */
router.delete('/remove-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password } = req.body;

    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings?.passwordHash) {
      return res.status(400).json({ error: 'No password configured' });
    }

    // Verify password
    if (!password) {
      return res.status(400).json({ error: 'Password is required to remove protection' });
    }

    const valid = await bcrypt.compare(password, settings.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Remove password
    await prisma.settings.update({
      where: { id: 'singleton' },
      data: { passwordHash: null },
    });

    // Clear all sessions
    await prisma.session.deleteMany({});

    res.clearCookie('session', { path: '/' });
    res.json({ success: true, message: 'Password protection removed' });
  } catch (error) {
    console.error('Error removing password:', error);
    res.status(500).json({ error: 'Failed to remove password' });
  }
});

/**
 * GET /api/auth/settings
 * Get auth settings
 */
router.get('/settings', requireAuth, async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    res.json({
      hasPassword: !!settings?.passwordHash,
      autoLockMinutes: settings?.autoLockMinutes || 0,
      lockScreenBg: settings?.lockScreenBg || 'storm-clouds',
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Valid lock screen backgrounds
const VALID_LOCK_SCREEN_BGS = [
  'lightning',
  'thunder-flash',
  'storm-clouds',
  'electric-storm',
  'night-lightning',
  'sky-thunder',
];

/**
 * PUT /api/auth/settings
 * Update auth settings
 */
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { autoLockMinutes, lockScreenBg } = req.body;

    const updateData: { autoLockMinutes?: number; lockScreenBg?: string } = {};

    if (typeof autoLockMinutes === 'number' && autoLockMinutes >= 0) {
      updateData.autoLockMinutes = autoLockMinutes;
    }

    if (typeof lockScreenBg === 'string' && VALID_LOCK_SCREEN_BGS.includes(lockScreenBg)) {
      updateData.lockScreenBg = lockScreenBg;
    }

    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: updateData,
      create: { id: 'singleton', ...updateData },
    });

    res.json({
      hasPassword: !!settings.passwordHash,
      autoLockMinutes: settings.autoLockMinutes,
      lockScreenBg: settings.lockScreenBg,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * POST /api/auth/seed
 * Get the wallet seed phrase (requires password verification)
 * This is a highly sensitive operation - only available if password is configured
 */
router.post('/seed', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password } = req.body;

    // Get settings to check if password is configured
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    });

    // Password must be configured to access seed
    if (!settings?.passwordHash) {
      return res.status(403).json({
        error: 'Password protection must be enabled to view seed phrase',
      });
    }

    // Verify password
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const valid = await bcrypt.compare(password, settings.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Read seed file
    const seedPath = process.env.PHOENIXD_SEED_PATH || '/phoenix-data/seed.dat';

    if (!fs.existsSync(seedPath)) {
      return res.status(404).json({ error: 'Seed file not found' });
    }

    const seedContent = fs.readFileSync(seedPath, 'utf-8').trim();

    // The seed.dat file contains the 12-word mnemonic
    res.json({ seed: seedContent });
  } catch (error) {
    console.error('Error getting seed:', error);
    res.status(500).json({ error: 'Failed to retrieve seed' });
  }
});

export { router as authRouter };
