import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhoenixdService } from './phoenixd';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PhoenixdService', () => {
  let service: PhoenixdService;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PHOENIXD_URL = 'http://localhost:9740';
    process.env.PHOENIXD_PASSWORD = 'testpassword';
    service = new PhoenixdService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', () => {
      const phoenixdUrl = process.env.PHOENIXD_URL || 'http://localhost:9740';
      expect(phoenixdUrl).toBeDefined();
      expect(typeof phoenixdUrl).toBe('string');
    });

    it('should use default URL when PHOENIXD_URL is not set', () => {
      delete process.env.PHOENIXD_URL;
      const newService = new PhoenixdService();
      expect(newService).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should generate correct Basic auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ nodeId: 'test' }),
      });

      await service.getInfo();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });
  });

  describe('Node Management', () => {
    describe('getInfo', () => {
      it('should return node info on success', async () => {
        const mockResponse = {
          nodeId: 'test-node-id',
          channels: [
            {
              state: 'NORMAL',
              channelId: 'channel-1',
              balanceSat: 100000,
              inboundLiquiditySat: 50000,
              capacitySat: 150000,
              fundingTxId: 'tx-id',
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.getInfo();
        expect(result).toEqual(mockResponse);
      });

      it('should throw error on API failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
        });

        await expect(service.getInfo()).rejects.toThrow('Phoenixd API error: 500');
      });
    });

    describe('getBalance', () => {
      it('should return balance on success', async () => {
        const mockResponse = { balanceSat: 100000, feeCreditSat: 1000 };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.getBalance();
        expect(result).toEqual(mockResponse);
      });

      it('should handle zero balance', async () => {
        const mockResponse = { balanceSat: 0, feeCreditSat: 0 };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.getBalance();
        expect(result.balanceSat).toBe(0);
        expect(result.feeCreditSat).toBe(0);
      });
    });

    describe('listChannels', () => {
      it('should return empty array when no channels', async () => {
        // listChannels now calls getInfo internally
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              nodeId: 'test-node-id',
              channels: [],
            }),
        });

        const result = await service.listChannels();
        expect(result).toEqual([]);
      });

      it('should return channels array', async () => {
        const mockChannels = [
          {
            channelId: 'ch1',
            state: 'NORMAL',
            balanceSat: 100000,
            inboundLiquiditySat: 900000,
            capacitySat: 1000000,
            fundingTxId: 'tx1',
          },
          {
            channelId: 'ch2',
            state: 'CLOSING',
            balanceSat: 50000,
            inboundLiquiditySat: 450000,
            capacitySat: 500000,
            fundingTxId: 'tx2',
          },
        ];

        // listChannels now calls getInfo internally
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({
              nodeId: 'test-node-id',
              channels: mockChannels,
            }),
        });

        const result = await service.listChannels();
        expect(result).toHaveLength(2);
        expect(result[0].channelId).toBe('ch1');
        expect(result[1].channelId).toBe('ch2');
      });
    });

    describe('closeChannel', () => {
      it('should close channel and return txId', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/plain' },
          text: () => Promise.resolve('tx-close-id'),
        });

        const result = await service.closeChannel({
          channelId: 'ch1',
          address: 'bc1q...',
          feerateSatByte: 10,
        });

        expect(result).toBe('tx-close-id');
      });

      it('should send form-encoded body for POST requests', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/plain' },
          text: () => Promise.resolve('tx-id'),
        });

        await service.closeChannel({
          channelId: 'ch1',
          address: 'bc1q...',
          feerateSatByte: 10,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/closechannel'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/x-www-form-urlencoded',
            }),
          })
        );
      });
    });

    describe('estimateLiquidityFees', () => {
      it('should return fee estimates', async () => {
        const mockFees = { miningFeeSat: 500, serviceFeeSat: 100 };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockFees),
        });

        const result = await service.estimateLiquidityFees(100000);
        expect(result).toEqual(mockFees);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('amountSat=100000'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Payments - Create', () => {
    describe('createInvoice', () => {
      it('should create invoice with all parameters', async () => {
        const mockInvoice = {
          amountSat: 1000,
          paymentHash: 'a'.repeat(64),
          serialized: 'lnbc...',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockInvoice),
        });

        const result = await service.createInvoice({
          description: 'Test payment',
          amountSat: 1000,
          expirySeconds: 3600,
          externalId: 'ext-1',
        });

        expect(result).toEqual(mockInvoice);
      });

      it('should create invoice without amount (zero-amount invoice)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () =>
            Promise.resolve({ amountSat: 0, paymentHash: 'a'.repeat(64), serialized: 'lnbc...' }),
        });

        const result = await service.createInvoice({
          description: 'Variable amount',
        });

        expect(result.amountSat).toBe(0);
      });
    });

    describe('createOffer', () => {
      it('should create bolt12 offer', async () => {
        const mockOffer = { offer: 'lno1...' };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockOffer),
        });

        const result = await service.createOffer({
          description: 'Test offer',
          amountSat: 5000,
        });

        expect(result).toEqual(mockOffer);
      });
    });

    describe('getLnAddress', () => {
      it('should return lightning address', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/plain' },
          text: () => Promise.resolve('user@example.com'),
        });

        const result = await service.getLnAddress();
        expect(result).toBe('user@example.com');
      });
    });
  });

  describe('Payments - Pay', () => {
    const mockPaymentResponse = {
      recipientAmountSat: 1000,
      routingFeeSat: 10,
      paymentId: 'pay-id',
      paymentHash: 'a'.repeat(64),
      paymentPreimage: 'b'.repeat(64),
    };

    describe('payInvoice', () => {
      it('should pay bolt11 invoice', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockPaymentResponse),
        });

        const result = await service.payInvoice({ invoice: 'lnbc1...' });
        expect(result).toEqual(mockPaymentResponse);
      });

      it('should pay invoice with specific amount', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockPaymentResponse),
        });

        await service.payInvoice({ invoice: 'lnbc1...', amountSat: 5000 });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('amountSat=5000'),
          })
        );
      });
    });

    describe('payOffer', () => {
      it('should pay bolt12 offer with message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockPaymentResponse),
        });

        const result = await service.payOffer({
          offer: 'lno1...',
          amountSat: 1000,
          message: 'Thanks!',
        });

        expect(result).toEqual(mockPaymentResponse);
      });
    });

    describe('payLnAddress', () => {
      it('should pay to lightning address', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockPaymentResponse),
        });

        const result = await service.payLnAddress({
          address: 'user@example.com',
          amountSat: 1000,
        });

        expect(result).toEqual(mockPaymentResponse);
      });
    });

    describe('sendToAddress', () => {
      it('should send on-chain payment', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/plain' },
          text: () => Promise.resolve('onchain-tx-id'),
        });

        const result = await service.sendToAddress({
          address: 'bc1q...',
          amountSat: 50000,
          feerateSatByte: 10,
        });

        expect(result).toBe('onchain-tx-id');
      });
    });

    describe('bumpFee', () => {
      it('should bump fee for pending transaction', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/plain' },
          text: () => Promise.resolve('new-tx-id'),
        });

        const result = await service.bumpFee(20);
        expect(result).toBe('new-tx-id');
      });
    });
  });

  describe('Payments - List', () => {
    describe('listIncomingPayments', () => {
      it('should list all incoming payments', async () => {
        const mockPayments = [
          { paymentHash: 'a'.repeat(64), receivedSat: 1000 },
          { paymentHash: 'b'.repeat(64), receivedSat: 2000 },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockPayments),
        });

        const result = await service.listIncomingPayments();
        expect(result).toHaveLength(2);
      });

      it('should apply filters correctly', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve([]),
        });

        await service.listIncomingPayments({
          from: 1000,
          to: 2000,
          limit: 10,
          offset: 0,
          all: true,
          externalId: 'ext-1',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(
            /from=1000.*to=2000.*limit=10.*offset=0.*all=true.*externalId=ext-1/
          ),
          expect.any(Object)
        );
      });
    });

    describe('getIncomingPayment', () => {
      it('should get specific payment by hash', async () => {
        const paymentHash = 'a'.repeat(64);
        const mockPayment = { paymentHash, receivedSat: 1000 };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockPayment),
        });

        const result = await service.getIncomingPayment(paymentHash);
        expect(result).toEqual(mockPayment);
      });
    });

    describe('listOutgoingPayments', () => {
      it('should list outgoing payments with pagination', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve([]),
        });

        await service.listOutgoingPayments({ limit: 5, offset: 10 });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('limit=5'),
          expect.any(Object)
        );
      });
    });

    describe('getOutgoingPayment', () => {
      it('should get payment by ID', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ paymentId: 'pay-1' }),
        });

        const result = await service.getOutgoingPayment('pay-1');
        expect(result).toEqual({ paymentId: 'pay-1' });
      });
    });

    describe('getOutgoingPaymentByHash', () => {
      it('should get payment by hash', async () => {
        const hash = 'a'.repeat(64);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ paymentHash: hash }),
        });

        const result = await service.getOutgoingPaymentByHash(hash);
        expect(result).toEqual({ paymentHash: hash });
      });
    });

    describe('exportCsv', () => {
      it('should export payments as CSV', async () => {
        const csvData = 'date,amount,type\n2024-01-01,1000,incoming';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/csv' },
          text: () => Promise.resolve(csvData),
        });

        const result = await service.exportCsv(1000, 2000);
        expect(result).toBe(csvData);
      });
    });
  });

  describe('Decode', () => {
    describe('decodeInvoice', () => {
      it('should decode bolt11 invoice', async () => {
        const mockDecoded = {
          chain: 'mainnet',
          amount: 1000,
          paymentHash: 'a'.repeat(64),
          description: 'Test',
          minFinalCltvExpiryDelta: 40,
          paymentSecret: 'b'.repeat(64),
          timestampSeconds: Date.now(),
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockDecoded),
        });

        const result = await service.decodeInvoice('lnbc1...');
        expect(result).toEqual(mockDecoded);
      });

      it('should throw error for invalid invoice', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Invalid invoice'),
        });

        await expect(service.decodeInvoice('invalid')).rejects.toThrow();
      });
    });

    describe('decodeOffer', () => {
      it('should decode bolt12 offer', async () => {
        const mockDecoded = {
          chain: 'mainnet',
          chainHashes: ['hash1', 'hash2'],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockDecoded),
        });

        const result = await service.decodeOffer('lno1...');
        expect(result).toEqual(mockDecoded);
      });
    });
  });

  describe('LNURL', () => {
    describe('lnurlPay', () => {
      it('should pay via LNURL', async () => {
        const mockResponse = {
          recipientAmountSat: 1000,
          routingFeeSat: 5,
          paymentId: 'pay-1',
          paymentHash: 'a'.repeat(64),
          paymentPreimage: 'b'.repeat(64),
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.lnurlPay('lnurl1...', 1000, 'Thanks');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('lnurlWithdraw', () => {
      it('should process LNURL withdraw', async () => {
        const mockResponse = {
          url: 'https://example.com/callback',
          minWithdrawable: 1000,
          maxWithdrawable: 10000,
          description: 'Withdraw',
          k1: 'random-k1',
          invoice: 'lnbc1...',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve(mockResponse),
        });

        const result = await service.lnurlWithdraw('lnurl1...');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('lnurlAuth', () => {
      it('should authenticate via LNURL', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'text/plain' },
          text: () => Promise.resolve('OK'),
        });

        const result = await service.lnurlAuth('lnurl1...');
        expect(result).toBe('OK');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getInfo()).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(service.getBalance()).rejects.toThrow('Request timeout');
    });

    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(service.getInfo()).rejects.toThrow('Phoenixd API error: 401');
    });

    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(service.getIncomingPayment('invalid')).rejects.toThrow(
        'Phoenixd API error: 404'
      );
    });
  });
});

describe('Utility Functions', () => {
  it('should validate satoshi amounts', () => {
    const isValidAmount = (amount: number) => amount >= 0 && Number.isInteger(amount);

    expect(isValidAmount(100)).toBe(true);
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(1.5)).toBe(false);
    expect(isValidAmount(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it('should validate payment hashes', () => {
    const isValidPaymentHash = (hash: string) => /^[a-f0-9]{64}$/i.test(hash);

    expect(isValidPaymentHash('a'.repeat(64))).toBe(true);
    expect(isValidPaymentHash('A'.repeat(64))).toBe(true);
    expect(isValidPaymentHash('aAbB1234' + 'c'.repeat(56))).toBe(true);
    expect(isValidPaymentHash('invalid')).toBe(false);
    expect(isValidPaymentHash('')).toBe(false);
    expect(isValidPaymentHash('g'.repeat(64))).toBe(false);
    expect(isValidPaymentHash('a'.repeat(63))).toBe(false);
    expect(isValidPaymentHash('a'.repeat(65))).toBe(false);
  });

  it('should validate lightning invoices prefix', () => {
    const isValidInvoicePrefix = (invoice: string) => /^ln(bc|tb|bcrt)/i.test(invoice);

    expect(isValidInvoicePrefix('lnbc1...')).toBe(true);
    expect(isValidInvoicePrefix('lntb1...')).toBe(true);
    expect(isValidInvoicePrefix('lnbcrt1...')).toBe(true);
    expect(isValidInvoicePrefix('LNBC1...')).toBe(true);
    expect(isValidInvoicePrefix('invalid')).toBe(false);
  });

  it('should validate bitcoin addresses', () => {
    const isValidBitcoinAddress = (address: string) => /^(bc1|tb1|[13]|[mn2])/.test(address);

    expect(isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
    expect(isValidBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
    expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
    expect(isValidBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true);
    expect(isValidBitcoinAddress('invalid')).toBe(false);
  });
});
