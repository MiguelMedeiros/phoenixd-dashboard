import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the environment variable
vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4001');

// Import after mocking
import {
  getNodeInfo,
  getBalance,
  listChannels,
  closeChannel,
  estimateLiquidityFees,
  createInvoice,
  createOffer,
  getLnAddress,
  payInvoice,
  payOffer,
  payLnAddress,
  sendToAddress,
  bumpFee,
  getIncomingPayments,
  getIncomingPayment,
  getOutgoingPayments,
  getOutgoingPayment,
  exportPayments,
  decodeInvoice,
  decodeOffer,
  lnurlPay,
  lnurlWithdraw,
  lnurlAuth,
  // Auth functions
  getAuthStatus,
  setupPassword,
  login,
  logout,
  changePassword,
  removePassword,
  getAuthSettings,
  updateAuthSettings,
  getSeed,
} from '@/lib/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockSuccessResponse = (data: unknown) => ({
    ok: true,
    json: () => Promise.resolve(data),
  });

  const mockErrorResponse = (status: number, error: string) => ({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  });

  describe('Node Management', () => {
    describe('getNodeInfo', () => {
      it('should fetch node info successfully', async () => {
        const mockInfo = {
          nodeId: '02abc...',
          chain: 'mainnet',
          version: '1.0.0',
          channels: [],
        };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockInfo));

        const result = await getNodeInfo();

        expect(result).toEqual(mockInfo);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/node/info',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });

      it('should throw on error response', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Server error'));

        await expect(getNodeInfo()).rejects.toThrow('Server error');
      });
    });

    describe('getBalance', () => {
      it('should fetch balance successfully', async () => {
        const mockBalance = { balanceSat: 100000, feeCreditSat: 5000 };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockBalance));

        const result = await getBalance();

        expect(result.balanceSat).toBe(100000);
        expect(result.feeCreditSat).toBe(5000);
      });

      it('should handle zero balance', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ balanceSat: 0, feeCreditSat: 0 }));

        const result = await getBalance();

        expect(result.balanceSat).toBe(0);
      });
    });

    describe('listChannels', () => {
      it('should fetch channels list', async () => {
        const mockChannels = [
          { channelId: 'ch1', state: 'NORMAL', balanceSat: 50000 },
          { channelId: 'ch2', state: 'CLOSING', balanceSat: 25000 },
        ];

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockChannels));

        const result = await listChannels();

        expect(result).toHaveLength(2);
        expect(result[0].channelId).toBe('ch1');
      });

      it('should handle empty channels', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse([]));

        const result = await listChannels();

        expect(result).toEqual([]);
      });
    });

    describe('closeChannel', () => {
      it('should close channel successfully', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ txId: 'tx-close-id' }));

        const result = await closeChannel({
          channelId: 'ch1',
          address: 'bc1q...',
          feerateSatByte: 10,
        });

        expect(result.txId).toBe('tx-close-id');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/node/channels/close'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              channelId: 'ch1',
              address: 'bc1q...',
              feerateSatByte: 10,
            }),
          })
        );
      });
    });

    describe('estimateLiquidityFees', () => {
      it('should fetch fee estimates', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ miningFeeSat: 1000, serviceFeeSat: 250 })
        );

        const result = await estimateLiquidityFees({ amountSat: 100000 });

        expect(result.miningFeeSat).toBe(1000);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('amountSat=100000'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Payments - Create', () => {
    describe('createInvoice', () => {
      it('should create invoice with all params', async () => {
        const mockInvoice = {
          amountSat: 5000,
          paymentHash: 'a'.repeat(64),
          serialized: 'lnbc50u1...',
        };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockInvoice));

        const result = await createInvoice({
          description: 'Test',
          amountSat: 5000,
          expirySeconds: 3600,
        });

        expect(result.serialized).toContain('lnbc');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/phoenixd/createinvoice'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('should create zero-amount invoice', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ amountSat: 0, paymentHash: 'b'.repeat(64), serialized: 'lnbc1...' })
        );

        const result = await createInvoice({ description: 'Variable' });

        expect(result.amountSat).toBe(0);
      });
    });

    describe('createOffer', () => {
      it('should create bolt12 offer', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ offer: 'lno1...' }));

        const result = await createOffer({ description: 'My offer' });

        expect(result.offer).toContain('lno');
      });
    });

    describe('getLnAddress', () => {
      it('should get lightning address', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ lnaddress: 'user@example.com' }));

        const result = await getLnAddress();

        expect(result.lnaddress).toBe('user@example.com');
      });
    });
  });

  describe('Payments - Pay', () => {
    const mockPaymentResult = {
      recipientAmountSat: 1000,
      routingFeeSat: 10,
      paymentId: 'pay-1',
      paymentHash: 'a'.repeat(64),
      paymentPreimage: 'b'.repeat(64),
    };

    describe('payInvoice', () => {
      it('should pay bolt11 invoice', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockPaymentResult));

        const result = await payInvoice({ invoice: 'lnbc100n1...' });

        expect(result.paymentPreimage).toHaveLength(64);
      });

      it('should pay with custom amount', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockPaymentResult));

        await payInvoice({ invoice: 'lnbc1...', amountSat: 5000 });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('"amountSat":5000'),
          })
        );
      });
    });

    describe('payOffer', () => {
      it('should pay bolt12 offer', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockPaymentResult));

        const result = await payOffer({
          offer: 'lno1...',
          amountSat: 1000,
          message: 'Thanks!',
        });

        expect(result).toEqual(mockPaymentResult);
      });
    });

    describe('payLnAddress', () => {
      it('should pay to lightning address', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockPaymentResult));

        const result = await payLnAddress({
          address: 'user@getalby.com',
          amountSat: 1000,
        });

        expect(result.recipientAmountSat).toBe(1000);
      });
    });

    describe('sendToAddress', () => {
      it('should send on-chain payment', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ txId: 'onchain-tx-id' }));

        const result = await sendToAddress({
          address: 'bc1q...',
          amountSat: 50000,
          feerateSatByte: 10,
        });

        expect(result.txId).toBe('onchain-tx-id');
      });
    });

    describe('bumpFee', () => {
      it('should bump transaction fee', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ txId: 'new-tx-id' }));

        const result = await bumpFee(20);

        expect(result.txId).toBe('new-tx-id');
      });
    });
  });

  describe('Payments - List', () => {
    describe('getIncomingPayments', () => {
      it('should list incoming payments', async () => {
        const mockPayments = [
          { paymentHash: 'a'.repeat(64), receivedSat: 1000, isPaid: true },
          { paymentHash: 'b'.repeat(64), receivedSat: 2000, isPaid: true },
        ];

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockPayments));

        const result = await getIncomingPayments();

        expect(result).toHaveLength(2);
      });

      it('should apply filters', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse([]));

        await getIncomingPayments({
          from: 1000,
          to: 2000,
          limit: 10,
          offset: 0,
          all: true,
          externalId: 'ext-1',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/from=1000.*to=2000.*limit=10/),
          expect.any(Object)
        );
      });
    });

    describe('getIncomingPayment', () => {
      it('should get specific payment', async () => {
        const hash = 'a'.repeat(64);
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ paymentHash: hash, receivedSat: 5000 })
        );

        const result = await getIncomingPayment(hash);

        expect(result.paymentHash).toBe(hash);
      });
    });

    describe('getOutgoingPayments', () => {
      it('should list outgoing payments', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse([{ paymentId: 'pay-1', sent: 1000, isPaid: true }])
        );

        const result = await getOutgoingPayments();

        expect(result).toHaveLength(1);
      });
    });

    describe('getOutgoingPayment', () => {
      it('should get specific outgoing payment', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ paymentId: 'pay-1', sent: 1000 }));

        const result = await getOutgoingPayment('pay-1');

        expect(result.paymentId).toBe('pay-1');
      });
    });

    describe('exportPayments', () => {
      it('should export payments as text', async () => {
        const csvData = 'date,type,amount\n2024-01-01,incoming,1000';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(csvData),
        });

        const result = await exportPayments(1000, 2000);

        expect(result).toBe(csvData);
      });

      it('should throw on export failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
        });

        await expect(exportPayments()).rejects.toThrow('Failed to export payments');
      });
    });
  });

  describe('Decode', () => {
    describe('decodeInvoice', () => {
      it('should decode bolt11 invoice', async () => {
        const mockDecoded = {
          prefix: 'lnbc',
          timestamp: 1700000000,
          nodeId: '02abc...',
          description: 'Test',
          paymentHash: 'a'.repeat(64),
          expiry: 3600,
        };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockDecoded));

        const result = await decodeInvoice({ invoice: 'lnbc1...' });

        expect(result.prefix).toBe('lnbc');
      });
    });

    describe('decodeOffer', () => {
      it('should decode bolt12 offer', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({
            offerId: 'offer-1',
            description: 'My offer',
            nodeId: '02abc...',
          })
        );

        const result = await decodeOffer({ offer: 'lno1...' });

        expect(result.offerId).toBe('offer-1');
      });
    });
  });

  describe('LNURL', () => {
    describe('lnurlPay', () => {
      it('should pay via LNURL', async () => {
        const mockResult = {
          recipientAmountSat: 1000,
          routingFeeSat: 5,
          paymentId: 'pay-1',
          paymentHash: 'a'.repeat(64),
          paymentPreimage: 'b'.repeat(64),
        };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockResult));

        const result = await lnurlPay({
          lnurl: 'lnurl1...',
          amountSat: 1000,
          message: 'Thanks',
        });

        expect(result).toEqual(mockResult);
      });
    });

    describe('lnurlWithdraw', () => {
      it('should process LNURL withdraw', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({
            receivedSat: 5000,
            paymentHash: 'a'.repeat(64),
          })
        );

        const result = await lnurlWithdraw({ lnurl: 'lnurl1...' });

        expect(result.receivedSat).toBe(5000);
      });
    });

    describe('lnurlAuth', () => {
      it('should authenticate via LNURL', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ success: true }));

        const result = await lnurlAuth({ lnurl: 'lnurl1...' });

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getNodeInfo()).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(getNodeInfo()).rejects.toThrow();
    });

    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Unauthorized'));

      await expect(getBalance()).rejects.toThrow('Unauthorized');
    });

    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Not found'));

      await expect(getIncomingPayment('invalid')).rejects.toThrow('Not found');
    });

    it('should handle error without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error')),
      });

      await expect(getNodeInfo()).rejects.toThrow('Unknown error');
    });
  });

  describe('Authentication', () => {
    describe('getAuthStatus', () => {
      it('should fetch auth status', async () => {
        const mockStatus = {
          hasPassword: true,
          authenticated: true,
          autoLockMinutes: 5,
          lockScreenBg: 'storm-clouds',
        };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockStatus));

        const result = await getAuthStatus();

        expect(result).toEqual(mockStatus);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/status',
          expect.objectContaining({
            credentials: 'include',
          })
        );
      });

      it('should return unauthenticated status', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({
            hasPassword: true,
            authenticated: false,
            autoLockMinutes: 0,
            lockScreenBg: 'storm-clouds',
          })
        );

        const result = await getAuthStatus();

        expect(result.authenticated).toBe(false);
        expect(result.hasPassword).toBe(true);
      });
    });

    describe('setupPassword', () => {
      it('should setup password successfully', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ success: true, message: 'Password set' })
        );

        const result = await setupPassword('mypassword123');

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/setup',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ password: 'mypassword123' }),
          })
        );
      });

      it('should handle setup error when password already exists', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(400, 'Password already configured'));

        await expect(setupPassword('password')).rejects.toThrow('Password already configured');
      });
    });

    describe('login', () => {
      it('should login successfully', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ success: true }));

        const result = await login('correctpassword');

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/login',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ password: 'correctpassword' }),
          })
        );
      });

      it('should fail with invalid password', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid password'));

        await expect(login('wrongpassword')).rejects.toThrow('Invalid password');
      });
    });

    describe('logout', () => {
      it('should logout successfully', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse({ success: true }));

        const result = await logout();

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/logout',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    describe('changePassword', () => {
      it('should change password successfully', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ success: true, message: 'Password changed' })
        );

        const result = await changePassword('oldpass', 'newpass');

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/change-password',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ currentPassword: 'oldpass', newPassword: 'newpass' }),
          })
        );
      });

      it('should fail with wrong current password', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Current password is incorrect'));

        await expect(changePassword('wrong', 'newpass')).rejects.toThrow(
          'Current password is incorrect'
        );
      });
    });

    describe('removePassword', () => {
      it('should remove password successfully', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ success: true, message: 'Password removed' })
        );

        const result = await removePassword('currentpass');

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/remove-password',
          expect.objectContaining({
            method: 'DELETE',
            body: JSON.stringify({ password: 'currentpass' }),
          })
        );
      });

      it('should fail with wrong password', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid password'));

        await expect(removePassword('wrong')).rejects.toThrow('Invalid password');
      });
    });

    describe('getAuthSettings', () => {
      it('should fetch auth settings', async () => {
        const mockSettings = {
          autoLockMinutes: 10,
          lockScreenBg: 'lightning',
        };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockSettings));

        const result = await getAuthSettings();

        expect(result).toEqual(mockSettings);
      });
    });

    describe('updateAuthSettings', () => {
      it('should update auto-lock setting', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ autoLockMinutes: 15, lockScreenBg: 'storm-clouds' })
        );

        const result = await updateAuthSettings({ autoLockMinutes: 15 });

        expect(result.autoLockMinutes).toBe(15);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/settings',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ autoLockMinutes: 15 }),
          })
        );
      });

      it('should update lock screen background', async () => {
        mockFetch.mockResolvedValueOnce(
          mockSuccessResponse({ autoLockMinutes: 0, lockScreenBg: 'electric-storm' })
        );

        const result = await updateAuthSettings({ lockScreenBg: 'electric-storm' });

        expect(result.lockScreenBg).toBe('electric-storm');
      });
    });

    describe('getSeed', () => {
      it('should get seed phrase with valid password', async () => {
        const mockSeed = {
          seed: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        };

        mockFetch.mockResolvedValueOnce(mockSuccessResponse(mockSeed));

        const result = await getSeed('mypassword');

        expect(result.seed).toBe(mockSeed.seed);
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4001/api/auth/seed',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ password: 'mypassword' }),
          })
        );
      });

      it('should fail with invalid password', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid password'));

        await expect(getSeed('wrongpassword')).rejects.toThrow('Invalid password');
      });

      it('should fail when no password is configured', async () => {
        mockFetch.mockResolvedValueOnce(
          mockErrorResponse(403, 'Password protection must be enabled to view seed phrase')
        );

        await expect(getSeed('password')).rejects.toThrow(
          'Password protection must be enabled to view seed phrase'
        );
      });

      it('should fail when not authenticated', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Unauthorized'));

        await expect(getSeed('password')).rejects.toThrow('Unauthorized');
      });
    });
  });
});
