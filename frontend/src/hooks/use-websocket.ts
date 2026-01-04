'use client';

import { useEffect, useRef, useState } from 'react';

interface PaymentEvent {
  type: string;
  amountSat?: number;
  paymentHash?: string;
  payerNote?: string;
  payerKey?: string;
  externalId?: string;
}

interface UseWebSocketOptions {
  onPaymentReceived?: (event: PaymentEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// Get WebSocket URL dynamically based on access method
function getWebSocketUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  // If accessing via Tailscale Magic DNS, use relative WebSocket URL
  if (hostname.endsWith('.ts.net')) {
    return `${protocol}//${hostname}`;
  }

  return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const connectingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      // Prevent multiple simultaneous connection attempts
      if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      connectingRef.current = true;
      const wsUrl = getWebSocketUrl();

      try {
        const ws = new WebSocket(`${wsUrl}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) {
            ws.close();
            return;
          }
          connectingRef.current = false;
          console.log('WebSocket connected');
          setIsConnected(true);
          options.onConnect?.();
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(event.data) as PaymentEvent;
            if (data.type === 'payment_received') {
              options.onPaymentReceived?.(data);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          connectingRef.current = false;
          wsRef.current = null;

          if (!mountedRef.current) return;

          console.log('WebSocket disconnected');
          setIsConnected(false);
          options.onDisconnect?.();

          // Reconnect after 5 seconds if still mounted
          if (mountedRef.current) {
            reconnectTimeoutRef.current = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          connectingRef.current = false;
          console.error('WebSocket error');
        };
      } catch (error) {
        connectingRef.current = false;
        console.error('Error connecting to WebSocket:', error);

        if (mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      connectingRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return { isConnected };
}
