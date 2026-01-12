import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsEvents, WS_EVENTS } from '@/lib/websocket-events';

describe('WebSocket Events', () => {
  beforeEach(() => {
    // Clear all listeners between tests by creating a fresh state
    vi.resetAllMocks();
  });

  describe('Event Emitter', () => {
    it('should emit and receive events', () => {
      const callback = vi.fn();
      const unsubscribe = wsEvents.on('test-event', callback);

      wsEvents.emit('test-event', { data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
      unsubscribe();
    });

    it('should support multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = wsEvents.on('multi-event', callback1);
      const unsub2 = wsEvents.on('multi-event', callback2);

      wsEvents.emit('multi-event', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');

      unsub1();
      unsub2();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = wsEvents.on('unsub-event', callback);

      wsEvents.emit('unsub-event', 'first');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      wsEvents.emit('unsub-event', 'second');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple arguments in emit', () => {
      const callback = vi.fn();
      const unsubscribe = wsEvents.on('args-event', callback);

      wsEvents.emit('args-event', 'arg1', 'arg2', { key: 'value' });

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
      unsubscribe();
    });

    it('should not fail when emitting to non-existent event', () => {
      expect(() => {
        wsEvents.emit('non-existent-event', 'data');
      }).not.toThrow();
    });

    it('should handle errors in callbacks gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const unsub1 = wsEvents.on('error-event', errorCallback);
      const unsub2 = wsEvents.on('error-event', normalCallback);

      wsEvents.emit('error-event', 'data');

      // Error callback threw, but normal callback should still be called
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      unsub1();
      unsub2();
      consoleSpy.mockRestore();
    });

    it('should remove listener with off method', () => {
      const callback = vi.fn();
      wsEvents.on('off-event', callback);

      wsEvents.emit('off-event', 'first');
      expect(callback).toHaveBeenCalledTimes(1);

      wsEvents.off('off-event', callback);

      wsEvents.emit('off-event', 'second');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Names', () => {
    it('should have PAYMENT_RECEIVED event defined', () => {
      expect(WS_EVENTS.PAYMENT_RECEIVED).toBe('payment_received');
    });

    it('should have RECURRING_PAYMENT_EXECUTED event defined', () => {
      expect(WS_EVENTS.RECURRING_PAYMENT_EXECUTED).toBe('recurring_payment_executed');
    });

    it('should have SERVICE_EVENT event defined', () => {
      expect(WS_EVENTS.SERVICE_EVENT).toBe('service_event');
    });
  });

  describe('Subscription Pattern', () => {
    it('should support React useEffect cleanup pattern', () => {
      const callback = vi.fn();

      // Simulate useEffect
      const cleanup = wsEvents.on(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, callback);

      wsEvents.emit(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, { id: '1' });
      expect(callback).toHaveBeenCalledTimes(1);

      // Simulate component unmount (useEffect cleanup)
      cleanup();

      wsEvents.emit(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, { id: '2' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid subscribe/unsubscribe', () => {
      const callbacks = Array.from({ length: 10 }, () => vi.fn());
      const unsubscribers: (() => void)[] = [];

      // Subscribe all
      callbacks.forEach((cb, i) => {
        unsubscribers.push(wsEvents.on(`rapid-event-${i}`, cb));
      });

      // Emit to all
      callbacks.forEach((_, i) => {
        wsEvents.emit(`rapid-event-${i}`, i);
      });

      // All should be called
      callbacks.forEach((cb, i) => {
        expect(cb).toHaveBeenCalledWith(i);
      });

      // Unsubscribe all
      unsubscribers.forEach((unsub) => unsub());

      // Emit again - none should be called again
      callbacks.forEach((_, i) => {
        wsEvents.emit(`rapid-event-${i}`, i);
      });

      callbacks.forEach((cb) => {
        expect(cb).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Payment Event Scenarios', () => {
    it('should handle recurring payment event with full data', () => {
      const callback = vi.fn();
      const unsubscribe = wsEvents.on(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, callback);

      const paymentEvent = {
        recurringPaymentId: 'rp-123',
        contactId: 'contact-456',
        contactName: 'Alice',
        amountSat: 10000,
        paymentId: 'pay-789',
        paymentHash: 'abc123',
        timestamp: Date.now(),
      };

      wsEvents.emit(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, paymentEvent);

      expect(callback).toHaveBeenCalledWith(paymentEvent);
      unsubscribe();
    });

    it('should handle service events', () => {
      const callback = vi.fn();
      const unsubscribe = wsEvents.on(WS_EVENTS.SERVICE_EVENT, callback);

      const serviceEvent = {
        type: 'cloudflared:connected',
        message: 'Tunnel connected',
      };

      wsEvents.emit(WS_EVENTS.SERVICE_EVENT, serviceEvent);

      expect(callback).toHaveBeenCalledWith(serviceEvent);
      unsubscribe();
    });
  });
});
