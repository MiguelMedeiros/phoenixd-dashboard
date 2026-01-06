import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Use vi.hoisted to create mocks that work with hoisted vi.mock calls
const { mockLnurlPay, mockLnurlWithdraw, mockLnurlAuth } = vi.hoisted(() => ({
  mockLnurlPay: vi.fn(),
  mockLnurlWithdraw: vi.fn(),
  mockLnurlAuth: vi.fn(),
}));

// Mock the auth middleware to allow all requests
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  AuthenticatedRequest: {},
}));

// Mock the phoenixd service
vi.mock('../index.js', () => ({
  phoenixd: {
    lnurlPay: mockLnurlPay,
    lnurlWithdraw: mockLnurlWithdraw,
    lnurlAuth: mockLnurlAuth,
  },
}));

import { lnurlRouter } from './lnurl';

const mockPhoenixd = { lnurlPay: mockLnurlPay, lnurlWithdraw: mockLnurlWithdraw, lnurlAuth: mockLnurlAuth };

describe('LNURL Routes', () => {
  let app: express.Express;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Silence console.error during tests (expected errors from route handlers)
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    app = express();
    app.use(express.json());
    app.use('/api/lnurl', lnurlRouter);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('POST /pay', () => {
    it('should process LNURL pay successfully', async () => {
      const mockResult = {
        recipientAmountSat: 1000,
        routingFeeSat: 5,
        paymentId: 'pay-1',
        paymentHash: 'a'.repeat(64),
        paymentPreimage: 'b'.repeat(64),
      };

      mockPhoenixd.lnurlPay.mockResolvedValueOnce(mockResult);

      const response = await request(app).post('/api/lnurl/pay').send({
        lnurl: 'lnurl1dp68gurn8ghj7...',
        amountSat: '1000',
        message: 'Thanks!',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockPhoenixd.lnurlPay).toHaveBeenCalledWith('lnurl1dp68gurn8ghj7...', 1000, 'Thanks!');
    });

    it('should process LNURL pay without message', async () => {
      mockPhoenixd.lnurlPay.mockResolvedValueOnce({
        recipientAmountSat: 500,
        routingFeeSat: 2,
        paymentId: 'pay-2',
        paymentHash: 'c'.repeat(64),
        paymentPreimage: 'd'.repeat(64),
      });

      const response = await request(app).post('/api/lnurl/pay').send({
        lnurl: 'lnurl1...',
        amountSat: '500',
      });

      expect(response.status).toBe(200);
      expect(mockPhoenixd.lnurlPay).toHaveBeenCalledWith('lnurl1...', 500, undefined);
    });

    it('should return 500 on LNURL pay error', async () => {
      mockPhoenixd.lnurlPay.mockRejectedValueOnce(new Error('Invalid LNURL'));

      const response = await request(app).post('/api/lnurl/pay').send({
        lnurl: 'invalid',
        amountSat: '1000',
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Invalid LNURL');
    });

    it('should handle minimum amount not met', async () => {
      mockPhoenixd.lnurlPay.mockRejectedValueOnce(new Error('Amount below minimum'));

      const response = await request(app).post('/api/lnurl/pay').send({
        lnurl: 'lnurl1...',
        amountSat: '1',
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Amount below minimum');
    });

    it('should handle maximum amount exceeded', async () => {
      mockPhoenixd.lnurlPay.mockRejectedValueOnce(new Error('Amount exceeds maximum'));

      const response = await request(app).post('/api/lnurl/pay').send({
        lnurl: 'lnurl1...',
        amountSat: '999999999',
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Amount exceeds maximum');
    });
  });

  describe('POST /withdraw', () => {
    it('should process LNURL withdraw successfully', async () => {
      const mockResult = {
        url: 'https://example.com/callback',
        minWithdrawable: 1000,
        maxWithdrawable: 100000,
        description: 'Withdrawal from Example',
        k1: 'random-k1-value',
        invoice: 'lnbc1...',
      };

      mockPhoenixd.lnurlWithdraw.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/api/lnurl/withdraw')
        .send({ lnurl: 'lnurl1withdraw...' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockPhoenixd.lnurlWithdraw).toHaveBeenCalledWith('lnurl1withdraw...');
    });

    it('should return 500 on invalid LNURL withdraw', async () => {
      mockPhoenixd.lnurlWithdraw.mockRejectedValueOnce(new Error('Invalid LNURL-withdraw'));

      const response = await request(app).post('/api/lnurl/withdraw').send({ lnurl: 'invalid' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Invalid LNURL-withdraw');
    });

    it('should handle expired LNURL withdraw', async () => {
      mockPhoenixd.lnurlWithdraw.mockRejectedValueOnce(new Error('LNURL expired'));

      const response = await request(app)
        .post('/api/lnurl/withdraw')
        .send({ lnurl: 'lnurl1expired...' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('LNURL expired');
    });
  });

  describe('POST /auth', () => {
    it('should process LNURL auth successfully', async () => {
      mockPhoenixd.lnurlAuth.mockResolvedValueOnce('OK');

      const response = await request(app).post('/api/lnurl/auth').send({ lnurl: 'lnurl1auth...' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'OK' });
      expect(mockPhoenixd.lnurlAuth).toHaveBeenCalledWith('lnurl1auth...');
    });

    it('should return 500 on LNURL auth failure', async () => {
      mockPhoenixd.lnurlAuth.mockRejectedValueOnce(new Error('Authentication failed'));

      const response = await request(app).post('/api/lnurl/auth').send({ lnurl: 'invalid-auth' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Authentication failed');
    });

    it('should handle malformed LNURL auth', async () => {
      mockPhoenixd.lnurlAuth.mockRejectedValueOnce(new Error('Malformed LNURL'));

      const response = await request(app).post('/api/lnurl/auth').send({ lnurl: 'not-a-lnurl' });

      expect(response.status).toBe(500);
    });
  });
});
