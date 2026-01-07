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

interface ServiceEvent {
  type:
    | 'cloudflared:connected'
    | 'cloudflared:disconnected'
    | 'cloudflared:error'
    | 'tor:connected'
    | 'tor:disconnected'
    | 'tailscale:connected'
    | 'tailscale:disconnected';
  message?: string;
}

interface UseWebSocketOptions {
  onPaymentReceived?: (event: PaymentEvent) => void;
  onServiceEvent?: (event: ServiceEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// Get WebSocket URL dynamically based on access method
// This enables WebSocket to work from any hostname without configuration
function getWebSocketUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;

  // If a custom WebSocket URL is explicitly configured (not the default localhost),
  // respect that configuration
  if (configuredUrl && !configuredUrl.includes('localhost:4001')) {
    return configuredUrl;
  }

  // Auto-detect WebSocket URL based on current hostname
  // This allows WebSocket to work when accessed via:
  // - localhost (development)
  // - Local IP (e.g., 192.168.1.100)
  // - Tailscale Magic DNS (*.ts.net)
  // - Custom domain

  // For Tailscale, use the hostname with port 4001
  if (hostname.endsWith('.ts.net')) {
    return `${protocol}//${hostname}:4001`;
  }

  // For localhost, use the default port mapping
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:4001';
  }

  // For any other hostname (IP address, domain, etc.),
  // auto-detect using the same hostname with backend port
  return `${protocol}//${hostname}:4001`;
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
            const data = JSON.parse(event.data);

            // Handle payment events
            if (data.type === 'payment_received') {
              options.onPaymentReceived?.(data as PaymentEvent);
            }

            // Handle service events (cloudflared, tor, tailscale)
            if (
              data.type?.startsWith('cloudflared:') ||
              data.type?.startsWith('tor:') ||
              data.type?.startsWith('tailscale:')
            ) {
              options.onServiceEvent?.(data as ServiceEvent);
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
