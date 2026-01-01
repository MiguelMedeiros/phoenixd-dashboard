'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { LockScreen } from '@/components/lock-screen';
import { Zap } from 'lucide-react';
import type { LockScreenBg } from '@/lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  hasPassword: boolean;
  autoLockMinutes: number;
  lockScreenBg: LockScreenBg;
  logout: () => Promise<void>;
  lock: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    isLoading,
    isAuthenticated,
    hasPassword,
    autoLockMinutes,
    lockScreenBg,
    error,
    login,
    logout,
    lock,
    refreshStatus,
  } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center premium-bg">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/20">
              <Zap className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show lock screen if not authenticated (and password is configured)
  if (!isAuthenticated && hasPassword) {
    return <LockScreen onUnlock={login} error={error} background={lockScreenBg} />;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        hasPassword,
        autoLockMinutes,
        lockScreenBg,
        logout,
        lock,
        refreshStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
