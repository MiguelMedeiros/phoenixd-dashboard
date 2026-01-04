'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDynamicUrls, detectAccessType, type DynamicUrls } from '@/lib/api';

interface UseDynamicUrlsResult {
  apiUrl: string;
  wsUrl: string;
  tailscaleApiUrl: string | null;
  tailscaleWsUrl: string | null;
  tailscaleFrontendUrl: string | null;
  tailscaleEnabled: boolean;
  tailscaleHealthy: boolean;
  tailscaleDnsName: string | null;
  isTailscaleAccess: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Default URLs (fallback)
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';

// Helper to detect Tailscale access from hostname
function isTailscaleHostname(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.ts.net');
}

// Get relative API URL for Tailscale access
function getRelativeApiUrl(): string {
  return ''; // Empty string means relative URL, Tailscale Serve handles routing
}

// Get relative WebSocket URL for Tailscale access
function getRelativeWsUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

// Cache for URLs to avoid repeated fetches
let cachedUrls: DynamicUrls | null = null;
let cachedIsTailscaleAccess: boolean = false;
let lastFetch: number = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Hook to get dynamic URLs based on access context (local vs Tailscale)
 */
export function useDynamicUrls(): UseDynamicUrlsResult {
  const [urls, setUrls] = useState<DynamicUrls>({
    apiUrl: DEFAULT_API_URL,
    wsUrl: DEFAULT_WS_URL,
    tailscaleApiUrl: null,
    tailscaleWsUrl: null,
    tailscaleFrontendUrl: null,
    tailscaleEnabled: false,
    tailscaleHealthy: false,
    tailscaleDnsName: null,
  });
  const [isTailscaleAccess, setIsTailscaleAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUrls = useCallback(async (force = false) => {
    const now = Date.now();

    // Use cache if available and not expired
    if (!force && cachedUrls && now - lastFetch < CACHE_TTL) {
      setUrls(cachedUrls);
      setIsTailscaleAccess(cachedIsTailscaleAccess);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch dynamic URLs from backend
      const dynamicUrls = await getDynamicUrls();

      // Detect if we're accessing via Tailscale
      let tailscaleAccess = false;
      if (dynamicUrls.tailscaleEnabled && dynamicUrls.tailscaleDnsName) {
        try {
          const accessInfo = await detectAccessType();
          tailscaleAccess = accessInfo.isTailscaleAccess;
        } catch {
          // If detection fails, check the current hostname
          if (typeof window !== 'undefined') {
            tailscaleAccess = window.location.hostname.includes(dynamicUrls.tailscaleDnsName || '');
          }
        }
      }

      // Update cache
      cachedUrls = dynamicUrls;
      cachedIsTailscaleAccess = tailscaleAccess;
      lastFetch = now;

      setUrls(dynamicUrls);
      setIsTailscaleAccess(tailscaleAccess);
    } catch (err) {
      console.error('Failed to fetch dynamic URLs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch URLs');

      // Use defaults on error
      setUrls({
        apiUrl: DEFAULT_API_URL,
        wsUrl: DEFAULT_WS_URL,
        tailscaleApiUrl: null,
        tailscaleWsUrl: null,
        tailscaleFrontendUrl: null,
        tailscaleEnabled: false,
        tailscaleHealthy: false,
        tailscaleDnsName: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  // Determine which URLs to use based on access context
  const effectiveApiUrl =
    isTailscaleAccess && urls.tailscaleApiUrl ? urls.tailscaleApiUrl : urls.apiUrl;
  const effectiveWsUrl =
    isTailscaleAccess && urls.tailscaleWsUrl ? urls.tailscaleWsUrl : urls.wsUrl;

  return {
    apiUrl: effectiveApiUrl,
    wsUrl: effectiveWsUrl,
    tailscaleApiUrl: urls.tailscaleApiUrl,
    tailscaleWsUrl: urls.tailscaleWsUrl,
    tailscaleFrontendUrl: urls.tailscaleFrontendUrl,
    tailscaleEnabled: urls.tailscaleEnabled,
    tailscaleHealthy: urls.tailscaleHealthy,
    tailscaleDnsName: urls.tailscaleDnsName,
    isTailscaleAccess,
    isLoading,
    error,
    refresh: () => fetchUrls(true),
  };
}

/**
 * Get the current API URL (can be called outside of React components)
 * Automatically detects Tailscale access and returns relative URLs
 */
export function getApiUrl(): string {
  // Direct hostname check for Tailscale - most reliable method
  if (isTailscaleHostname()) {
    return getRelativeApiUrl();
  }

  if (cachedUrls && cachedIsTailscaleAccess && cachedUrls.tailscaleApiUrl) {
    return cachedUrls.tailscaleApiUrl;
  }
  return cachedUrls?.apiUrl || DEFAULT_API_URL;
}

/**
 * Get the current WebSocket URL (can be called outside of React components)
 * Automatically detects Tailscale access and returns the correct URL
 */
export function getWsUrl(): string {
  // Direct hostname check for Tailscale - most reliable method
  if (isTailscaleHostname()) {
    return getRelativeWsUrl();
  }

  if (cachedUrls && cachedIsTailscaleAccess && cachedUrls.tailscaleWsUrl) {
    return cachedUrls.tailscaleWsUrl;
  }
  return cachedUrls?.wsUrl || DEFAULT_WS_URL;
}

/**
 * Clear the URL cache (call when Tailscale settings change)
 */
export function clearUrlCache(): void {
  cachedUrls = null;
  lastFetch = 0;
}
