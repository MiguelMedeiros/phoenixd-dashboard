'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMempoolData,
  type MempoolData,
  type FeeEstimates,
  type MempoolInfo,
} from '@/lib/mempool';

// Auto-refresh interval (60 seconds)
const REFRESH_INTERVAL_MS = 60_000;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

interface UseMempoolDataReturn {
  data: MempoolData | null;
  fees: FeeEstimates | null;
  mempool: MempoolInfo | null;
  blockHeight: number | null;
  loading: boolean;
  error: Error | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

export function useMempoolData(chain: string = 'mainnet'): UseMempoolDataReturn {
  const [data, setData] = useState<MempoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(
    async (isRetry: boolean = false) => {
      if (!isRetry) {
        setLoading(true);
      }

      try {
        const mempoolData = await getMempoolData(chain, true);
        setData(mempoolData);
        setError(null);
        retryCountRef.current = 0; // Reset retry count on success
      } catch (err) {
        console.error('Failed to fetch mempool data:', err);
        const error = err instanceof Error ? err : new Error('Failed to fetch mempool data');
        setError(error);

        // Retry with exponential backoff
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current);
          retryCountRef.current++;

          retryTimeoutRef.current = setTimeout(() => {
            fetchData(true);
          }, delay);
        }
      } finally {
        setLoading(false);
      }
    },
    [chain]
  );

  const refresh = useCallback(async () => {
    retryCountRef.current = 0; // Reset retry count on manual refresh
    await fetchData();
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    fees: data?.fees ?? null,
    mempool: data?.mempool ?? null,
    blockHeight: data?.blockHeight ?? null,
    loading,
    error,
    lastUpdated: data?.lastUpdated ?? null,
    refresh,
  };
}
