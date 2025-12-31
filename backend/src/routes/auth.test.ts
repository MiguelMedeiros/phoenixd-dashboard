import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

// Use vi.hoisted to create mocks that work with hoisted vi.mock calls
const {
  mockSettingsFindUnique,
  mockSettingsUpsert,
  mockSettingsUpdate,
  mockSessionCreate,
  mockSessionFindUnique,
  mockSessionDelete,
  mockSessionDeleteMany,
  mockSessionUpdate,
  mockBcryptHash,
  mockBcryptCompare,
  mockFsReadFileSync,
  mockFsExistsSync,
} = vi.hoisted(() => ({
  mockSettingsFindUnique: vi.fn(),
  mockSettingsUpsert: vi.fn(),
  mockSettingsUpdate: vi.fn(),
  mockSessionCreate: vi.fn(),
  mockSessionFindUnique: vi.fn(),
  mockSessionDelete: vi.fn(),
  mockSessionDeleteMany: vi.fn(),
  mockSessionUpdate: vi.fn(),
  mockBcryptHash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
  mockBcryptCompare: vi.fn(),
  mockFsReadFileSync: vi.fn(),
  mockFsExistsSync: vi.fn(),
}));

// Mock modules with factory functions
vi.mock('../index.js', () => ({
  prisma: {
    settings: {
      findUnique: mockSettingsFindUnique,
      upsert: mockSettingsUpsert,
      update: mockSettingsUpdate,
    },
    session: {
      create: mockSessionCreate,
      findUnique: mockSessionFindUnique,
      delete: mockSessionDelete,
      deleteMany: mockSessionDeleteMany,
      update: mockSessionUpdate,
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: mockBcryptHash,
    compare: mockBcryptCompare,
  },
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: mockFsReadFileSync,
    existsSync: mockFsExistsSync,
  },
}));

import { authRouter } from './auth';

describe('Auth Routes', () => {
  let app: express.Express;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRouter);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('GET /status', () => {
    it('should return no password when settings is null', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/auth/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasPassword: false,
        authenticated: true,
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
      });
    });

    it('should return hasPassword true when password is set', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 5,
        lockScreenBg: 'lightning',
      });
      mockSessionFindUnique.mockResolvedValueOnce(null);

      const response = await request(app).get('/api/auth/status');

      expect(response.status).toBe(200);
      expect(response.body.hasPassword).toBe(true);
      expect(response.body.authenticated).toBe(false);
      expect(response.body.autoLockMinutes).toBe(5);
      expect(response.body.lockScreenBg).toBe('lightning');
    });

    it('should return authenticated true with valid session', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
      });
      mockSessionFindUnique.mockResolvedValueOnce({
        id: 'session-123',
        expiresAt: futureDate,
      });

      const response = await request(app)
        .get('/api/auth/status')
        .set('Cookie', 'session=session-123');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
    });

    it('should return authenticated false with expired session', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
      });
      mockSessionFindUnique.mockResolvedValueOnce({
        id: 'session-123',
        expiresAt: pastDate,
      });

      const response = await request(app)
        .get('/api/auth/status')
        .set('Cookie', 'session=session-123');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
    });
  });

  describe('POST /setup', () => {
    it('should setup password successfully', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce(null);
      mockSettingsUpsert.mockResolvedValueOnce({
        id: 'singleton',
        passwordHash: '$2b$10$hashedpassword',
      });
      mockSessionCreate.mockResolvedValueOnce({
        id: 'new-session-123',
        expiresAt: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'mypassword123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password configured successfully');
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 when password is too short', async () => {
      const response = await request(app).post('/api/auth/setup').send({ password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password must be at least 4 characters');
    });

    it('should return 400 when password already exists', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$existinghash',
      });

      const response = await request(app).post('/api/auth/setup').send({ password: 'newpassword' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password already configured. Use change-password instead.');
    });
  });

  describe('POST /login', () => {
    it('should login successfully with correct password', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 0,
      });
      mockBcryptCompare.mockResolvedValueOnce(true as never);
      mockSessionCreate.mockResolvedValueOnce({
        id: 'new-session-456',
        expiresAt: new Date(),
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'correctpassword' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 400 when no password configured', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce(null);

      const response = await request(app).post('/api/auth/login').send({ password: 'anypassword' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No password configured');
    });

    it('should return 401 with wrong password', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
      });
      mockBcryptCompare.mockResolvedValueOnce(false as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid password');
    });
  });

  describe('POST /logout', () => {
    it('should logout and clear session', async () => {
      mockSessionDelete.mockResolvedValueOnce({ id: 'session-123' });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'session=session-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Check that cookie is being cleared
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return success even without session', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /change-password', () => {
    beforeEach(() => {
      // Mock for requireAuth middleware
      const futureDate = new Date(Date.now() + 3600000);
      mockSettingsFindUnique.mockResolvedValue({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 0,
      });
      mockSessionFindUnique.mockResolvedValue({
        id: 'session-123',
        expiresAt: futureDate,
      });
      mockSessionUpdate.mockResolvedValue({});
    });

    it('should change password successfully', async () => {
      mockBcryptCompare.mockResolvedValueOnce(true as never);
      mockSettingsUpdate.mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', 'session=session-123')
        .send({ currentPassword: 'oldpass', newPassword: 'newpass' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');
    });

    it('should return 401 with wrong current password', async () => {
      mockBcryptCompare.mockResolvedValueOnce(false as never);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', 'session=session-123')
        .send({ currentPassword: 'wrongpass', newPassword: 'newpass' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    it('should return 400 when new password is too short', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', 'session=session-123')
        .send({ currentPassword: 'oldpass', newPassword: '12' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('New password must be at least 4 characters');
    });
  });

  describe('DELETE /remove-password', () => {
    beforeEach(() => {
      const futureDate = new Date(Date.now() + 3600000);
      mockSettingsFindUnique.mockResolvedValue({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 0,
      });
      mockSessionFindUnique.mockResolvedValue({
        id: 'session-123',
        expiresAt: futureDate,
      });
      mockSessionUpdate.mockResolvedValue({});
    });

    it('should remove password successfully', async () => {
      mockBcryptCompare.mockResolvedValueOnce(true as never);
      mockSettingsUpdate.mockResolvedValueOnce({});
      mockSessionDeleteMany.mockResolvedValueOnce({ count: 1 });

      const response = await request(app)
        .delete('/api/auth/remove-password')
        .set('Cookie', 'session=session-123')
        .send({ password: 'correctpass' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password protection removed');
    });

    it('should return 401 with wrong password', async () => {
      mockBcryptCompare.mockResolvedValueOnce(false as never);

      const response = await request(app)
        .delete('/api/auth/remove-password')
        .set('Cookie', 'session=session-123')
        .send({ password: 'wrongpass' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid password');
    });
  });

  describe('GET /settings', () => {
    beforeEach(() => {
      // No password = no auth required (middleware allows through)
      mockSettingsFindUnique.mockResolvedValue(null);
    });

    it('should return default settings when none exist', async () => {
      const response = await request(app).get('/api/auth/settings');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasPassword: false,
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
      });
    });

    it('should return existing settings when authenticated', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      mockSettingsFindUnique.mockReset();
      // First call for middleware check
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 10,
        lockScreenBg: 'electric-storm',
      });
      mockSessionFindUnique.mockResolvedValueOnce({
        id: 'session-123',
        expiresAt: futureDate,
      });
      mockSessionUpdate.mockResolvedValueOnce({});
      // Second call for actual settings retrieval
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 10,
        lockScreenBg: 'electric-storm',
      });

      const response = await request(app)
        .get('/api/auth/settings')
        .set('Cookie', 'session=session-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        hasPassword: true,
        autoLockMinutes: 10,
        lockScreenBg: 'electric-storm',
      });
    });
  });

  describe('PUT /settings', () => {
    beforeEach(() => {
      // No password = no auth required
      mockSettingsFindUnique.mockResolvedValue(null);
    });

    it('should update auto-lock minutes', async () => {
      mockSettingsUpsert.mockResolvedValueOnce({
        passwordHash: null,
        autoLockMinutes: 15,
        lockScreenBg: 'storm-clouds',
      });

      const response = await request(app).put('/api/auth/settings').send({ autoLockMinutes: 15 });

      expect(response.status).toBe(200);
      expect(response.body.autoLockMinutes).toBe(15);
    });

    it('should update lock screen background', async () => {
      mockSettingsUpsert.mockResolvedValueOnce({
        passwordHash: null,
        autoLockMinutes: 0,
        lockScreenBg: 'night-lightning',
      });

      const response = await request(app)
        .put('/api/auth/settings')
        .send({ lockScreenBg: 'night-lightning' });

      expect(response.status).toBe(200);
      expect(response.body.lockScreenBg).toBe('night-lightning');
    });

    it('should ignore invalid lock screen background', async () => {
      // Invalid values are simply ignored, not rejected
      mockSettingsUpsert.mockResolvedValueOnce({
        passwordHash: null,
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
      });

      const response = await request(app)
        .put('/api/auth/settings')
        .send({ lockScreenBg: 'invalid-bg' });

      expect(response.status).toBe(200);
      // Should still return current/default value since invalid was ignored
      expect(response.body.lockScreenBg).toBe('storm-clouds');
    });

    it('should ignore negative auto-lock minutes', async () => {
      // Negative values are ignored, not rejected
      mockSettingsUpsert.mockResolvedValueOnce({
        passwordHash: null,
        autoLockMinutes: 0,
        lockScreenBg: 'storm-clouds',
      });

      const response = await request(app).put('/api/auth/settings').send({ autoLockMinutes: -5 });

      expect(response.status).toBe(200);
      // Should return current value since negative was ignored
      expect(response.body.autoLockMinutes).toBe(0);
    });
  });

  describe('POST /seed', () => {
    beforeEach(() => {
      const futureDate = new Date(Date.now() + 3600000);
      mockSettingsFindUnique.mockResolvedValue({
        passwordHash: '$2b$10$hashedpassword',
        autoLockMinutes: 0,
      });
      mockSessionFindUnique.mockResolvedValue({
        id: 'session-123',
        expiresAt: futureDate,
      });
      mockSessionUpdate.mockResolvedValue({});
    });

    it('should return seed phrase with valid password', async () => {
      mockBcryptCompare.mockResolvedValueOnce(true as never);
      mockFsExistsSync.mockReturnValueOnce(true);
      mockFsReadFileSync.mockReturnValueOnce(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      );

      const response = await request(app)
        .post('/api/auth/seed')
        .set('Cookie', 'session=session-123')
        .send({ password: 'correctpassword' });

      expect(response.status).toBe(200);
      expect(response.body.seed).toBe(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      );
    });

    it('should return 401 with wrong password', async () => {
      mockBcryptCompare.mockResolvedValueOnce(false as never);

      const response = await request(app)
        .post('/api/auth/seed')
        .set('Cookie', 'session=session-123')
        .send({ password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid password');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/seed')
        .set('Cookie', 'session=session-123')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password is required');
    });

    it('should return 403 when no password is configured', async () => {
      mockSettingsFindUnique.mockReset();
      mockSettingsFindUnique.mockResolvedValue({
        passwordHash: null,
        autoLockMinutes: 0,
      });

      const response = await request(app)
        .post('/api/auth/seed')
        .set('Cookie', 'session=session-123')
        .send({ password: 'anypassword' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Password protection must be enabled to view seed phrase');
    });

    it('should return 404 when seed file does not exist', async () => {
      mockBcryptCompare.mockResolvedValueOnce(true as never);
      mockFsExistsSync.mockReturnValueOnce(false);

      const response = await request(app)
        .post('/api/auth/seed')
        .set('Cookie', 'session=session-123')
        .send({ password: 'correctpassword' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Seed file not found');
    });
  });

  describe('Authentication Middleware', () => {
    it('should return 401 when session is missing for protected routes', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'new' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should return 401 when session is invalid', async () => {
      mockSettingsFindUnique.mockResolvedValueOnce({
        passwordHash: '$2b$10$hashedpassword',
      });
      mockSessionFindUnique.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', 'session=invalid-session')
        .send({ currentPassword: 'old', newPassword: 'new' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid session');
    });
  });
});
