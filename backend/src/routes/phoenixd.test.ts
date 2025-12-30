import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { phoenixdRouter } from './phoenixd';

// Mock the phoenixd service
vi.mock('../index.js', () => ({
  phoenixd: {
    createInvoice: vi.fn(),
    createOffer: vi.fn(),
    getLnAddress: vi.fn(),
    payInvoice: vi.fn(),
    payOffer: vi.fn(),
    payLnAddress: vi.fn(),
    sendToAddress: vi.fn(),
    bumpFee: vi.fn(),
    decodeInvoice: vi.fn(),
    decodeOffer: vi.fn(),
    exportCsv: vi.fn(),
  },
}));

import { phoenixd } from '../index.js';

const mockPhoenixd = vi.mocked(phoenixd);

describe('Phoenixd Routes', () => {
  let app: express.Express;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    // Silence console.error during tests (expected errors from route handlers)
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    app = express();
    app.use(express.json());
    app.use('/api/phoenixd', phoenixdRouter);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('POST /createinvoice', () => {
    it('should create invoice with all parameters', async () => {
      const mockInvoice = {
        amountSat: 5000,
        paymentHash: 'a'.repeat(64),
        serialized: 'lnbc50u1...',
      };

      mockPhoenixd.createInvoice.mockResolvedValueOnce(mockInvoice);

      const response = await request(app).post('/api/phoenixd/createinvoice').send({
        description: 'Test payment',
        amountSat: '5000',
        expirySeconds: '3600',
        externalId: 'ext-1',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockInvoice);
    });

    it('should create zero-amount invoice', async () => {
      mockPhoenixd.createInvoice.mockResolvedValueOnce({
        amountSat: 0,
        paymentHash: 'b'.repeat(64),
        serialized: 'lnbc1...',
      });

      const response = await request(app)
        .post('/api/phoenixd/createinvoice')
        .send({ description: 'Variable amount' });

      expect(response.status).toBe(200);
      expect(response.body.amountSat).toBe(0);
    });

    it('should use default description when none provided', async () => {
      mockPhoenixd.createInvoice.mockResolvedValueOnce({
        amountSat: 1000,
        paymentHash: 'c'.repeat(64),
        serialized: 'lnbc10u1...',
      });

      await request(app).post('/api/phoenixd/createinvoice').send({ amountSat: '1000' });

      expect(mockPhoenixd.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Phoenixd Dashboard Payment',
        })
      );
    });

    it('should handle invoice creation error', async () => {
      mockPhoenixd.createInvoice.mockRejectedValueOnce(new Error('Failed to create invoice'));

      const response = await request(app)
        .post('/api/phoenixd/createinvoice')
        .send({ amountSat: '1000' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create invoice');
    });
  });

  describe('POST /createoffer', () => {
    it('should create bolt12 offer', async () => {
      const mockOffer = { offer: 'lno1...' };

      mockPhoenixd.createOffer.mockResolvedValueOnce(mockOffer);

      const response = await request(app)
        .post('/api/phoenixd/createoffer')
        .send({ description: 'My offer', amountSat: '10000' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('offer');
    });

    it('should create offer without amount', async () => {
      mockPhoenixd.createOffer.mockResolvedValueOnce({ offer: 'lno1noamount...' });

      const response = await request(app)
        .post('/api/phoenixd/createoffer')
        .send({ description: 'Tips accepted' });

      expect(response.status).toBe(200);
      expect(mockPhoenixd.createOffer).toHaveBeenCalledWith({
        description: 'Tips accepted',
        amountSat: undefined,
      });
    });
  });

  describe('GET /getlnaddress', () => {
    it('should return lightning address', async () => {
      mockPhoenixd.getLnAddress.mockResolvedValueOnce('user@example.com');

      const response = await request(app).get('/api/phoenixd/getlnaddress');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ address: 'user@example.com' });
    });

    it('should handle missing lightning address', async () => {
      mockPhoenixd.getLnAddress.mockRejectedValueOnce(new Error('LN address not configured'));

      const response = await request(app).get('/api/phoenixd/getlnaddress');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /payinvoice', () => {
    const mockPaymentResult = {
      recipientAmountSat: 1000,
      routingFeeSat: 10,
      paymentId: 'pay-1',
      paymentHash: 'a'.repeat(64),
      paymentPreimage: 'b'.repeat(64),
    };

    it('should pay invoice successfully', async () => {
      mockPhoenixd.payInvoice.mockResolvedValueOnce(mockPaymentResult);

      const response = await request(app)
        .post('/api/phoenixd/payinvoice')
        .send({ invoice: 'lnbc100n1...' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockPaymentResult);
    });

    it('should pay invoice with specified amount', async () => {
      mockPhoenixd.payInvoice.mockResolvedValueOnce(mockPaymentResult);

      await request(app)
        .post('/api/phoenixd/payinvoice')
        .send({ invoice: 'lnbc1...', amountSat: '5000' });

      expect(mockPhoenixd.payInvoice).toHaveBeenCalledWith({
        invoice: 'lnbc1...',
        amountSat: 5000,
      });
    });

    it('should handle payment failure', async () => {
      mockPhoenixd.payInvoice.mockRejectedValueOnce(new Error('Route not found'));

      const response = await request(app)
        .post('/api/phoenixd/payinvoice')
        .send({ invoice: 'lnbc1...' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Route not found');
    });

    it('should handle insufficient balance', async () => {
      mockPhoenixd.payInvoice.mockRejectedValueOnce(new Error('Insufficient balance'));

      const response = await request(app)
        .post('/api/phoenixd/payinvoice')
        .send({ invoice: 'lnbc1000000n1...' });

      expect(response.status).toBe(500);
    });

    it('should handle phoenixd returning reason field in response', async () => {
      // When phoenixd returns HTTP 200 but with a reason field indicating failure
      // Use type assertion since phoenixd can return error responses with different shape
      mockPhoenixd.payInvoice.mockResolvedValueOnce({
        reason: 'payment could not be sent through existing channels',
      } as unknown as ReturnType<typeof phoenixd.payInvoice> extends Promise<infer T> ? T : never);

      const response = await request(app)
        .post('/api/phoenixd/payinvoice')
        .send({ invoice: 'lnbc1...' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('payment could not be sent through existing channels');
    });

    it('should handle phoenixd returning no_route_to_recipient reason', async () => {
      mockPhoenixd.payInvoice.mockResolvedValueOnce({
        reason: 'no_route_to_recipient',
      } as unknown as ReturnType<typeof phoenixd.payInvoice> extends Promise<infer T> ? T : never);

      const response = await request(app)
        .post('/api/phoenixd/payinvoice')
        .send({ invoice: 'lnbc1...' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('no_route_to_recipient');
    });
  });

  describe('POST /payoffer', () => {
    it('should pay bolt12 offer', async () => {
      const mockResult = {
        recipientAmountSat: 5000,
        routingFeeSat: 20,
        paymentId: 'pay-2',
        paymentHash: 'c'.repeat(64),
        paymentPreimage: 'd'.repeat(64),
      };

      mockPhoenixd.payOffer.mockResolvedValueOnce(mockResult);

      const response = await request(app).post('/api/phoenixd/payoffer').send({
        offer: 'lno1...',
        amountSat: '5000',
        message: 'Great work!',
      });

      expect(response.status).toBe(200);
      expect(mockPhoenixd.payOffer).toHaveBeenCalledWith({
        offer: 'lno1...',
        amountSat: 5000,
        message: 'Great work!',
      });
    });
  });

  describe('POST /paylnaddress', () => {
    it('should pay to lightning address', async () => {
      const mockResult = {
        recipientAmountSat: 1000,
        routingFeeSat: 5,
        paymentId: 'pay-3',
        paymentHash: 'e'.repeat(64),
        paymentPreimage: 'f'.repeat(64),
      };

      mockPhoenixd.payLnAddress.mockResolvedValueOnce(mockResult);

      const response = await request(app).post('/api/phoenixd/paylnaddress').send({
        address: 'user@getalby.com',
        amountSat: '1000',
        message: 'Thanks!',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
    });

    it('should handle invalid lightning address', async () => {
      mockPhoenixd.payLnAddress.mockRejectedValueOnce(new Error('Invalid lightning address'));

      const response = await request(app)
        .post('/api/phoenixd/paylnaddress')
        .send({ address: 'invalid', amountSat: '1000' });

      expect(response.status).toBe(500);
    });

    it('should handle phoenixd returning reason field in LN address payment', async () => {
      // When phoenixd returns HTTP 200 but with a reason field indicating failure
      // Use type assertion since phoenixd can return error responses with different shape
      mockPhoenixd.payLnAddress.mockResolvedValueOnce({
        reason: 'payment could not be sent through existing channels',
      } as unknown as ReturnType<typeof phoenixd.payLnAddress> extends Promise<infer T>
        ? T
        : never);

      const response = await request(app).post('/api/phoenixd/paylnaddress').send({
        address: 'user@getalby.com',
        amountSat: '1000',
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('payment could not be sent through existing channels');
    });

    it('should handle DNS resolution failure', async () => {
      mockPhoenixd.payLnAddress.mockRejectedValueOnce(
        new Error('cannot resolve address: could not connect to domain.com')
      );

      const response = await request(app).post('/api/phoenixd/paylnaddress').send({
        address: 'user@domain.com',
        amountSat: '1000',
      });

      // Should fail since manual LNURL resolution would also fail
      expect(response.status).toBe(500);
    });

    it('should pass message parameter to phoenixd', async () => {
      const mockResult = {
        recipientAmountSat: 1000,
        routingFeeSat: 5,
        paymentId: 'pay-4',
        paymentHash: 'g'.repeat(64),
        paymentPreimage: 'h'.repeat(64),
      };

      mockPhoenixd.payLnAddress.mockResolvedValueOnce(mockResult);

      await request(app).post('/api/phoenixd/paylnaddress').send({
        address: 'user@getalby.com',
        amountSat: '1000',
        message: 'Payment for services',
      });

      expect(mockPhoenixd.payLnAddress).toHaveBeenCalledWith({
        address: 'user@getalby.com',
        amountSat: 1000,
        message: 'Payment for services',
      });
    });
  });

  describe('POST /sendtoaddress', () => {
    it('should send on-chain payment', async () => {
      mockPhoenixd.sendToAddress.mockResolvedValueOnce('onchain-tx-id-123');

      const response = await request(app).post('/api/phoenixd/sendtoaddress').send({
        address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        amountSat: '50000',
        feerateSatByte: '10',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ txId: 'onchain-tx-id-123' });
    });

    it('should handle invalid bitcoin address', async () => {
      mockPhoenixd.sendToAddress.mockRejectedValueOnce(new Error('Invalid address'));

      const response = await request(app).post('/api/phoenixd/sendtoaddress').send({
        address: 'invalid-address',
        amountSat: '50000',
        feerateSatByte: '10',
      });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /bumpfee', () => {
    it('should bump transaction fee', async () => {
      mockPhoenixd.bumpFee.mockResolvedValueOnce('new-tx-id-456');

      const response = await request(app)
        .post('/api/phoenixd/bumpfee')
        .send({ feerateSatByte: '20' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ txId: 'new-tx-id-456' });
      expect(mockPhoenixd.bumpFee).toHaveBeenCalledWith(20);
    });

    it('should handle no pending transactions', async () => {
      mockPhoenixd.bumpFee.mockRejectedValueOnce(new Error('No pending transactions'));

      const response = await request(app)
        .post('/api/phoenixd/bumpfee')
        .send({ feerateSatByte: '20' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /decodeinvoice', () => {
    it('should decode bolt11 invoice', async () => {
      const mockDecoded = {
        chain: 'mainnet',
        amount: 100000,
        paymentHash: 'a'.repeat(64),
        description: 'Test payment',
        minFinalCltvExpiryDelta: 40,
        paymentSecret: 'b'.repeat(64),
        timestampSeconds: 1700000000,
      };

      mockPhoenixd.decodeInvoice.mockResolvedValueOnce(mockDecoded);

      const response = await request(app)
        .post('/api/phoenixd/decodeinvoice')
        .send({ invoice: 'lnbc1m1...' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDecoded);
    });

    it('should handle invalid invoice', async () => {
      mockPhoenixd.decodeInvoice.mockRejectedValueOnce(new Error('Invalid invoice format'));

      const response = await request(app)
        .post('/api/phoenixd/decodeinvoice')
        .send({ invoice: 'invalid' });

      expect(response.status).toBe(500);
    });

    it('should handle expired invoice', async () => {
      mockPhoenixd.decodeInvoice.mockRejectedValueOnce(new Error('Invoice expired'));

      const response = await request(app)
        .post('/api/phoenixd/decodeinvoice')
        .send({ invoice: 'lnbc1expired...' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /decodeoffer', () => {
    it('should decode bolt12 offer', async () => {
      const mockDecoded = {
        chain: 'mainnet',
        chainHashes: ['hash1', 'hash2'],
      };

      mockPhoenixd.decodeOffer.mockResolvedValueOnce(mockDecoded);

      const response = await request(app)
        .post('/api/phoenixd/decodeoffer')
        .send({ offer: 'lno1...' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDecoded);
    });

    it('should handle invalid offer', async () => {
      mockPhoenixd.decodeOffer.mockRejectedValueOnce(new Error('Invalid offer'));

      const response = await request(app)
        .post('/api/phoenixd/decodeoffer')
        .send({ offer: 'invalid' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /export', () => {
    it('should export payments as CSV', async () => {
      const csvData = 'date,type,amount\n2024-01-01,incoming,1000';

      mockPhoenixd.exportCsv.mockResolvedValueOnce(csvData);

      const response = await request(app)
        .post('/api/phoenixd/export')
        .send({ from: '1704067200', to: '1706745600' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: csvData });
    });

    it('should export all payments when no dates specified', async () => {
      mockPhoenixd.exportCsv.mockResolvedValueOnce('all,data');

      const response = await request(app).post('/api/phoenixd/export').send({});

      expect(response.status).toBe(200);
      expect(mockPhoenixd.exportCsv).toHaveBeenCalledWith(undefined, undefined);
    });
  });
});
