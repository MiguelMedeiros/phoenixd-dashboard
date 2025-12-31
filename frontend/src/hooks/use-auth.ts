'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAuthStatus,
  login as apiLogin,
  logout as apiLogout,
  type AuthStatus,
  type LockScreenBg,
} from '@/lib/api';

interface UseAuthReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPassword: boolean;
  autoLockMinutes: number;
  lockScreenBg: LockScreenBg;
  error: string | null;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  lock: () => void;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const authStatus = await getAuthStatus();
      setStatus(authStatus);

      // If we have a password but aren't authenticated, we're locked
      if (authStatus.hasPassword && !authStatus.authenticated) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      console.error('Error fetching auth status:', err);
      setError('Failed to check authentication status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    async (password: string): Promise<boolean> => {
      try {
        setError(null);
        await apiLogin(password);
        await refreshStatus();
        lastActivityRef.current = Date.now();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        return false;
      }
    },
    [refreshStatus]
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
      await refreshStatus();
    } catch (err) {
      console.error('Error logging out:', err);
    }
  }, [refreshStatus]);

  const lock = useCallback(() => {
    if (status?.hasPassword) {
      setIsLocked(true);
    }
  }, [status?.hasPassword]);

  // Initial status check
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-lock on inactivity
  useEffect(() => {
    if (!status?.hasPassword || !status.authenticated || status.autoLockMinutes === 0) {
      return;
    }

    const checkInactivity = () => {
      const now = Date.now();
      const inactiveMs = now - lastActivityRef.current;
      const lockAfterMs = status.autoLockMinutes * 60 * 1000;

      if (inactiveMs >= lockAfterMs) {
        setIsLocked(true);
      }
    };

    // Update last activity on user interaction
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Check every minute
    autoLockTimerRef.current = setInterval(checkInactivity, 60 * 1000);

    // Listen for user activity
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
      }
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, [status?.hasPassword, status?.authenticated, status?.autoLockMinutes]);

  // Determine if user is authenticated (not locked and has valid session)
  const isAuthenticated = !isLocked && (status?.authenticated ?? false);

  return {
    isLoading,
    isAuthenticated,
    hasPassword: status?.hasPassword ?? false,
    autoLockMinutes: status?.autoLockMinutes ?? 0,
    lockScreenBg: status?.lockScreenBg ?? 'lightning',
    error,
    login,
    logout,
    refreshStatus,
    lock,
  };
}
