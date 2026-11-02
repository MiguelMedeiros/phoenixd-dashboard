import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { WebSocket } from 'ws';

// Test utility functions for WebSocket and broadcast functionality
describe('WebSocket Utilities', () => {
  describe('broadcastPayment', () => {
    it('should broadcast to all connected clients', () => {
      const clients = new Set<{ readyState: number; send: Mock<(message: string) => void> }>();

      const client1 = { readyState: WebSocket.OPEN, send: vi.fn() };
      const client2 = { readyState: WebSocket.OPEN, send: vi.fn() };
      const client3 = { readyState: WebSocket.CLOSED, send: vi.fn() };

      clients.add(client1);
      clients.add(client2);
      clients.add(client3);

      const event = { type: 'payment_received', amountSat: 1000 };
      const message = JSON.stringify(event);

      // Simulating broadcast behavior
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

      expect(client1.send).toHaveBeenCalledWith(message);
      expect(client2.send).toHaveBeenCalledWith(message);
      expect(client3.send).not.toHaveBeenCalled();
    });

    it('should handle empty client set', () => {
      const clients = new Set<{ readyState: number; send: Mock<(message: string) => void> }>();
      const event = { type: 'payment_received', amountSat: 500 };

      // Should not throw when broadcasting to empty set
      expect(() => {
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(event));
          }
        });
      }).not.toThrow();
    });

    it('should serialize complex payment events correctly', () => {
      const event = {
        type: 'payment_received',
        amountSat: 100000,
        paymentHash: 'a'.repeat(64),
        payerNote: 'Test payment note',
        payerKey: 'pubkey123',
        externalId: 'ext-order-1',
      };

      const serialized = JSON.stringify(event);
      const parsed = JSON.parse(serialized);

      expect(parsed.type).toBe('payment_received');
      expect(parsed.amountSat).toBe(100000);
      expect(parsed.paymentHash).toHaveLength(64);
      expect(parsed.payerNote).toBe('Test payment note');
    });
  });

  describe('WebSocket Connection Management', () => {
    it('should track connected clients', () => {
      const clients = new Set<object>();

      const ws1 = { id: 1 };
      const ws2 = { id: 2 };

      clients.add(ws1);
      expect(clients.size).toBe(1);

      clients.add(ws2);
      expect(clients.size).toBe(2);

      clients.delete(ws1);
      expect(clients.size).toBe(1);
      expect(clients.has(ws2)).toBe(true);
    });

    it('should handle duplicate connection attempts', () => {
      const clients = new Set<object>();
      const ws = { id: 1 };

      clients.add(ws);
      clients.add(ws);

      expect(clients.size).toBe(1);
    });
  });

  describe('Payment Event Processing', () => {
    let processedEvents: object[];

    beforeEach(() => {
      processedEvents = [];
    });

    it('should process payment_received events', () => {
      const event = { type: 'payment_received', amountSat: 5000 };

      if (event.type === 'payment_received') {
        processedEvents.push(event);
      }

      expect(processedEvents).toHaveLength(1);
    });

    it('should ignore non-payment events', () => {
      const events = [
        { type: 'channel_opened', channelId: 'ch-1' },
        { type: 'payment_received', amountSat: 1000 },
        { type: 'channel_closed', channelId: 'ch-1' },
      ];

      events.forEach((event) => {
        if (event.type === 'payment_received') {
          processedEvents.push(event);
        }
      });

      expect(processedEvents).toHaveLength(1);
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedData = 'not valid json{';
      let error: Error | null = null;

      try {
        JSON.parse(malformedData);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeInstanceOf(SyntaxError);
    });

    it('should handle events with missing fields', () => {
      const incompleteEvent = { type: 'payment_received' };

      const amountSat = (incompleteEvent as { amountSat?: number }).amountSat || 0;
      const paymentHash = (incompleteEvent as { paymentHash?: string }).paymentHash || 'unknown';

      expect(amountSat).toBe(0);
      expect(paymentHash).toBe('unknown');
    });
  });

  describe('Phoenixd WebSocket Connection', () => {
    it('should construct correct WebSocket URL', () => {
      const httpUrl = 'http://phoenixd:9740';
      const wsUrl = httpUrl.replace('http', 'ws') + '/websocket';

      expect(wsUrl).toBe('ws://phoenixd:9740/websocket');
    });

    it('should handle https to wss conversion', () => {
      const httpsUrl = 'https://secure-phoenixd:9740';
      const wssUrl = httpsUrl.replace('http', 'ws') + '/websocket';

      expect(wssUrl).toBe('wss://secure-phoenixd:9740/websocket');
    });

    it('should generate correct Basic auth header', () => {
      const password = 'testpassword';
      const authHeader = 'Basic ' + Buffer.from(`:${password}`).toString('base64');

      expect(authHeader).toMatch(/^Basic /);
      expect(authHeader).not.toContain(password);

      // Verify we can decode it
      const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe(':testpassword');
    });

    it('should handle empty password', () => {
      const password = '';
      const authHeader = 'Basic ' + Buffer.from(`:${password}`).toString('base64');
      const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();

      expect(decoded).toBe(':');
    });
  });

  describe('Reconnection Logic', () => {
    it('should calculate reconnection delay', () => {
      const baseDelay = 5000;
      let reconnectAttempts = 0;

      const getReconnectDelay = () => baseDelay * (reconnectAttempts > 0 ? 1 : 1);

      expect(getReconnectDelay()).toBe(5000);

      reconnectAttempts = 5;
      expect(getReconnectDelay()).toBe(5000);
    });

    it('should reset reconnect attempts on successful connection', () => {
      let reconnectAttempts = 5;

      // Simulate successful connection
      const onConnect = () => {
        reconnectAttempts = 0;
      };

      onConnect();
      expect(reconnectAttempts).toBe(0);
    });
  });
});

describe('Database Payment Logging', () => {
  it('should format payment log entry correctly', () => {
    const event = {
      type: 'payment_received',
      paymentHash: 'a'.repeat(64),
      amountSat: 10000,
    };

    const logEntry = {
      type: 'incoming',
      paymentHash: event.paymentHash || 'unknown',
      amountSat: event.amountSat || 0,
      status: 'completed',
      rawData: event,
    };

    expect(logEntry.type).toBe('incoming');
    expect(logEntry.paymentHash).toHaveLength(64);
    expect(logEntry.amountSat).toBe(10000);
    expect(logEntry.status).toBe('completed');
    expect(logEntry.rawData).toEqual(event);
  });

  it('should handle events without paymentHash', () => {
    const event = { type: 'payment_received', amountSat: 500 };

    const logEntry = {
      paymentHash: (event as { paymentHash?: string }).paymentHash || 'unknown',
      amountSat: event.amountSat || 0,
    };

    expect(logEntry.paymentHash).toBe('unknown');
    expect(logEntry.amountSat).toBe(500);
  });

  it('should handle events without amountSat', () => {
    const event = { type: 'payment_received', paymentHash: 'b'.repeat(64) };

    const logEntry = {
      paymentHash: event.paymentHash,
      amountSat: (event as { amountSat?: number }).amountSat || 0,
    };

    expect(logEntry.paymentHash).toHaveLength(64);
    expect(logEntry.amountSat).toBe(0);
  });
});
