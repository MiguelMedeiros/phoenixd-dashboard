import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { nodeRouter } from './node';

// Mock the phoenixd service
vi.mock('../index.js', () => ({
  phoenixd: {
    getInfo: vi.fn(),
    getBalance: vi.fn(),
    listChannels: vi.fn(),
    closeChannel: vi.fn(),
    estimateLiquidityFees: vi.fn(),
  },
}));

import { phoenixd } from '../index.js';

const mockPhoenixd = vi.mocked(phoenixd);

describe('Node Routes', () => {
  let app: express.Express;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Silence console.error during tests (expected errors from route handlers)
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    app = express();
    app.use(express.json());
    app.use('/api/node', nodeRouter);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('GET /info', () => {
    it('should return node info', async () => {
      const mockInfo = {
        nodeId: 'test-node-id-123',
        channels: [
          {
            state: 'NORMAL',
            channelId: 'ch-1',
            balanceSat: 100000,
            inboundLiquiditySat: 50000,
            capacitySat: 150000,
            fundingTxId: 'tx-1',
          },
        ],
      };

      mockPhoenixd.getInfo.mockResolvedValueOnce(mockInfo);

      const response = await request(app).get('/api/node/info');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockInfo);
      expect(mockPhoenixd.getInfo).toHaveBeenCalledTimes(1);
    });

    it('should return 500 on error', async () => {
      mockPhoenixd.getInfo.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app).get('/api/node/info');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Connection failed');
    });
  });

  describe('GET /balance', () => {
    it('should return balance', async () => {
      const mockBalance = { balanceSat: 250000, feeCreditSat: 5000 };

      mockPhoenixd.getBalance.mockResolvedValueOnce(mockBalance);

      const response = await request(app).get('/api/node/balance');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBalance);
    });

    it('should handle zero balance', async () => {
      mockPhoenixd.getBalance.mockResolvedValueOnce({ balanceSat: 0, feeCreditSat: 0 });

      const response = await request(app).get('/api/node/balance');

      expect(response.status).toBe(200);
      expect(response.body.balanceSat).toBe(0);
    });

    it('should return 500 on service error', async () => {
      mockPhoenixd.getBalance.mockRejectedValueOnce(new Error('Service unavailable'));

      const response = await request(app).get('/api/node/balance');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Service unavailable');
    });
  });

  describe('GET /channels', () => {
    it('should return list of channels', async () => {
      const mockChannels = [
        {
          channelId: 'ch-1',
          state: 'NORMAL',
          balanceSat: 100000,
          inboundLiquiditySat: 900000,
          capacitySat: 1000000,
          fundingTxId: 'tx-1',
        },
        {
          channelId: 'ch-2',
          state: 'CLOSING',
          balanceSat: 50000,
          inboundLiquiditySat: 450000,
          capacitySat: 500000,
          fundingTxId: 'tx-2',
        },
      ];

      mockPhoenixd.listChannels.mockResolvedValueOnce(mockChannels);

      const response = await request(app).get('/api/node/channels');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return empty array when no channels', async () => {
      mockPhoenixd.listChannels.mockResolvedValueOnce([]);

      const response = await request(app).get('/api/node/channels');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /channels/close', () => {
    it('should close channel successfully', async () => {
      mockPhoenixd.closeChannel.mockResolvedValueOnce('close-tx-id');

      const response = await request(app).post('/api/node/channels/close').send({
        channelId: 'ch-1',
        address: 'bc1q...',
        feerateSatByte: '10',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ txId: 'close-tx-id' });
      expect(mockPhoenixd.closeChannel).toHaveBeenCalledWith({
        channelId: 'ch-1',
        address: 'bc1q...',
        feerateSatByte: 10,
      });
    });

    it('should handle invalid feerate', async () => {
      mockPhoenixd.closeChannel.mockRejectedValueOnce(new Error('Invalid feerate'));

      const response = await request(app).post('/api/node/channels/close').send({
        channelId: 'ch-1',
        address: 'bc1q...',
        feerateSatByte: 'invalid',
      });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /estimatefees', () => {
    it('should return fee estimates', async () => {
      const mockFees = { miningFeeSat: 1000, serviceFeeSat: 250 };

      mockPhoenixd.estimateLiquidityFees.mockResolvedValueOnce(mockFees);

      const response = await request(app)
        .get('/api/node/estimatefees')
        .query({ amountSat: '500000' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockFees);
      expect(mockPhoenixd.estimateLiquidityFees).toHaveBeenCalledWith(500000);
    });

    it('should return 400 when amountSat is missing', async () => {
      const response = await request(app).get('/api/node/estimatefees');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('amountSat is required');
    });

    it('should handle service error', async () => {
      mockPhoenixd.estimateLiquidityFees.mockRejectedValueOnce(new Error('Fee estimation failed'));

      const response = await request(app)
        .get('/api/node/estimatefees')
        .query({ amountSat: '100000' });

      expect(response.status).toBe(500);
    });
  });
});
