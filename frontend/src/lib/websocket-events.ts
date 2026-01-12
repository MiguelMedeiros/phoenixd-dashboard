'use client';

// Simple event emitter for WebSocket events
// This allows components to subscribe to WebSocket events without creating multiple connections

type EventCallback = (...args: unknown[]) => void;

class WebSocketEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in WebSocket event handler for ${event}:`, error);
      }
    });
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }
}

// Singleton instance
export const wsEvents = new WebSocketEventEmitter();

// Event names
export const WS_EVENTS = {
  PAYMENT_RECEIVED: 'payment_received',
  RECURRING_PAYMENT_EXECUTED: 'recurring_payment_executed',
  SERVICE_EVENT: 'service_event',
} as const;
