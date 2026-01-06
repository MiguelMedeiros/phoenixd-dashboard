import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Use vi.hoisted to create mocks that work with hoisted vi.mock calls
const {
  mockListIncomingPayments,
  mockGetIncomingPayment,
  mockListOutgoingPayments,
  mockGetOutgoingPayment,
  mockGetOutgoingPaymentByHash,
} = vi.hoisted(() => ({
  mockListIncomingPayments: vi.fn(),
  mockGetIncomingPayment: vi.fn(),
  mockListOutgoingPayments: vi.fn(),
  mockGetOutgoingPayment: vi.fn(),
  mockGetOutgoingPaymentByHash: vi.fn(),
}));

// Mock the auth middleware to allow all requests
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  AuthenticatedRequest: {},
}));

// Mock the phoenixd service
vi.mock('../index.js', () => ({
  phoenixd: {
    listIncomingPayments: mockListIncomingPayments,
    getIncomingPayment: mockGetIncomingPayment,
    listOutgoingPayments: mockListOutgoingPayments,
    getOutgoingPayment: mockGetOutgoingPayment,
    getOutgoingPaymentByHash: mockGetOutgoingPaymentByHash,
  },
}));

import { paymentsRouter } from './payments';

const mockPhoenixd = {
  listIncomingPayments: mockListIncomingPayments,
  getIncomingPayment: mockGetIncomingPayment,
  listOutgoingPayments: mockListOutgoingPayments,
  getOutgoingPayment: mockGetOutgoingPayment,
  getOutgoingPaymentByHash: mockGetOutgoingPaymentByHash,
};

describe('Payments Routes', () => {
  let app: express.Express;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Silence console.error during tests (expected errors from route handlers)
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    app = express();
    app.use(express.json());
    app.use('/api/payments', paymentsRouter);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('GET /incoming', () => {
    it('should return list of incoming payments', async () => {
      const mockPayments = [
        { paymentHash: 'a'.repeat(64), receivedSat: 1000, isPaid: true },
        { paymentHash: 'b'.repeat(64), receivedSat: 2000, isPaid: true },
      ];

      mockPhoenixd.listIncomingPayments.mockResolvedValueOnce(mockPayments);

      const response = await request(app).get('/api/payments/incoming');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should apply query filters', async () => {
      mockPhoenixd.listIncomingPayments.mockResolvedValueOnce([]);

      await request(app).get('/api/payments/incoming').query({
        from: '1000',
        to: '2000',
        limit: '10',
        offset: '0',
        all: 'true',
        externalId: 'ext-123',
      });

      expect(mockPhoenixd.listIncomingPayments).toHaveBeenCalledWith({
        from: 1000,
        to: 2000,
        limit: 10,
        offset: 0,
        all: true,
        externalId: 'ext-123',
      });
    });

    it('should handle undefined query params', async () => {
      mockPhoenixd.listIncomingPayments.mockResolvedValueOnce([]);

      await request(app).get('/api/payments/incoming');

      expect(mockPhoenixd.listIncomingPayments).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        limit: undefined,
        offset: undefined,
        all: false,
        externalId: undefined,
      });
    });

    it('should return 500 on error', async () => {
      mockPhoenixd.listIncomingPayments.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/api/payments/incoming');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /incoming/:paymentHash', () => {
    it('should return specific incoming payment', async () => {
      const paymentHash = 'a'.repeat(64);
      const mockPayment = {
        paymentHash,
        receivedSat: 5000,
        isPaid: true,
        description: 'Test payment',
      };

      mockPhoenixd.getIncomingPayment.mockResolvedValueOnce(mockPayment);

      const response = await request(app).get(`/api/payments/incoming/${paymentHash}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPayment);
    });

    it('should handle non-existent payment', async () => {
      mockPhoenixd.getIncomingPayment.mockRejectedValueOnce(new Error('Payment not found'));

      const response = await request(app).get('/api/payments/incoming/invalid-hash');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Payment not found');
    });
  });

  describe('GET /outgoing', () => {
    it('should return list of outgoing payments', async () => {
      const mockPayments = [
        { paymentId: 'pay-1', sent: 1000, isPaid: true },
        { paymentId: 'pay-2', sent: 2000, isPaid: false },
      ];

      mockPhoenixd.listOutgoingPayments.mockResolvedValueOnce(mockPayments);

      const response = await request(app).get('/api/payments/outgoing');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should apply pagination', async () => {
      mockPhoenixd.listOutgoingPayments.mockResolvedValueOnce([]);

      await request(app).get('/api/payments/outgoing').query({
        limit: '5',
        offset: '10',
      });

      expect(mockPhoenixd.listOutgoingPayments).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        limit: 5,
        offset: 10,
        all: false,
      });
    });
  });

  describe('GET /outgoing/:paymentId', () => {
    it('should return specific outgoing payment', async () => {
      const mockPayment = {
        paymentId: 'pay-1',
        sent: 10000,
        fees: 100000, // fees are in millisatoshis (msat)
        isPaid: true,
      };

      mockPhoenixd.getOutgoingPayment.mockResolvedValueOnce(mockPayment);

      const response = await request(app).get('/api/payments/outgoing/pay-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPayment);
    });
  });

  describe('GET /outgoingbyhash/:paymentHash', () => {
    it('should return outgoing payment by hash', async () => {
      const paymentHash = 'c'.repeat(64);
      const mockPayment = {
        paymentId: 'pay-3',
        paymentHash,
        sent: 15000,
      };

      mockPhoenixd.getOutgoingPaymentByHash.mockResolvedValueOnce(mockPayment);

      const response = await request(app).get(`/api/payments/outgoingbyhash/${paymentHash}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPayment);
    });

    it('should handle payment not found', async () => {
      mockPhoenixd.getOutgoingPaymentByHash.mockRejectedValueOnce(new Error('Not found'));

      const response = await request(app).get('/api/payments/outgoingbyhash/invalid');

      expect(response.status).toBe(500);
    });
  });
});
