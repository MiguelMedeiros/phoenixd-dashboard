'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth-provider';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { formatSats } from '@/lib/utils';
import { useCallback, useRef, useState } from 'react';
import { type Notification } from '@/components/notifications-popover';
import { useTranslations } from 'next-intl';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const t = useTranslations('notifications');
  const tt = useTranslations('toast');
  const balanceRefreshRef = useRef<(() => void) | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refreshBalance = useCallback(() => {
    if (balanceRefreshRef.current) {
      balanceRefreshRef.current();
    }
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const handleNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const handleNotificationsMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleNotificationsClear = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleNotificationRemove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const { isConnected } = useWebSocket({
    onPaymentReceived: (event) => {
      // Show toast
      toast({
        title: `⚡ ${tt('paymentReceived')}`,
        description: `${formatSats(event.amountSat || 0)} ${tt('received')}${
          event.payerNote ? ` - "${event.payerNote}"` : ''
        }`,
        variant: 'default',
      });

      // Add notification
      addNotification({
        type: 'payment_received',
        title: t('paymentReceived'),
        message: event.payerNote || t('youReceivedPayment'),
        amount: event.amountSat || 0,
        timestamp: Date.now(),
      });

      refreshBalance();
    },
    onConnect: () => {
      console.log('WebSocket connected');
      addNotification({
        type: 'info',
        title: t('connected'),
        message: t('realTimeActive'),
        timestamp: Date.now(),
      });
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
  });

  return (
    <div className="premium-bg flex h-screen overflow-hidden">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          isConnected={isConnected}
          onRefreshBalance={refreshBalance}
          notifications={notifications}
          onNotificationRead={handleNotificationRead}
          onNotificationsMarkAllRead={handleNotificationsMarkAllRead}
          onNotificationsClear={handleNotificationsClear}
          onNotificationRemove={handleNotificationRemove}
        />

        {/* Page Content - Extra padding bottom for mobile nav */}
        <main className="flex-1 overflow-auto px-4 md:px-8 pb-24 md:pb-8">
          <div className="relative z-10">{children}</div>
        </main>
      </div>

      {/* Bottom Navigation - Only on mobile */}
      <BottomNav />

      <Toaster />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
