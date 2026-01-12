'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth-provider';
import { CurrencyProvider, useCurrencyContext } from '@/components/currency-provider';
import { AnimationProvider, useAnimationContext } from '@/components/animation-provider';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import {
  useNotifications,
  formatSatsForNotification,
  playNotificationSound,
} from '@/hooks/use-notifications';
import { useCallback, useRef, useState } from 'react';
import { type Notification } from '@/components/notifications-popover';
import { useTranslations } from 'next-intl';
import { wsEvents, WS_EVENTS } from '@/lib/websocket-events';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const t = useTranslations('notifications');
  const tt = useTranslations('toast');
  const { formatValue } = useCurrencyContext();
  const { playAnimation } = useAnimationContext();
  const balanceRefreshRef = useRef<(() => void) | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Push notifications hook
  const { sendNotification, isEnabled: pushNotificationsEnabled } = useNotifications();

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
      const amount = event.amountSat || 0;

      // Show toast
      toast({
        title: `⚡ ${tt('paymentReceived')}`,
        description: `${formatValue(amount)} ${tt('received')}${
          event.payerNote ? ` - "${event.payerNote}"` : ''
        }`,
        variant: 'default',
      });

      // Add in-app notification
      addNotification({
        type: 'payment_received',
        title: t('paymentReceived'),
        message: event.payerNote || t('youReceivedPayment'),
        amount: amount,
        timestamp: Date.now(),
      });

      // Fire celebration animation for any payment received! 🎉
      playAnimation(true);

      // Send push notification if enabled
      if (pushNotificationsEnabled) {
        sendNotification({
          title: `⚡ ${tt('paymentReceived')}`,
          body: `${formatSatsForNotification(amount)}${event.payerNote ? ` - "${event.payerNote}"` : ''}`,
          tag: `payment-${event.paymentHash || Date.now()}`,
          data: { paymentHash: event.paymentHash, amount },
        });

        // Play notification sound
        playNotificationSound();
      }

      refreshBalance();
    },
    onRecurringPaymentExecuted: (event) => {
      const amount = event.amountSat || 0;

      // Show toast for recurring payment
      toast({
        title: `🔄 ${tt('recurringPaymentSent')}`,
        description: `${formatValue(amount)} ${tt('sentTo')} ${event.contactName}`,
        variant: 'default',
      });

      // Add in-app notification
      addNotification({
        type: 'payment_sent',
        title: t('recurringPaymentExecuted'),
        message: `${t('sentTo')} ${event.contactName}`,
        amount: amount,
        timestamp: Date.now(),
      });

      // Fire celebration animation for recurring payments! 🎉
      playAnimation(true);

      // Send push notification if enabled
      if (pushNotificationsEnabled) {
        sendNotification({
          title: `🔄 ${tt('recurringPaymentSent')}`,
          body: `${formatSatsForNotification(amount)} ${tt('sentTo')} ${event.contactName}`,
          tag: `recurring-${event.recurringPaymentId}-${Date.now()}`,
          data: { recurringPaymentId: event.recurringPaymentId, amount },
        });

        // Play notification sound
        playNotificationSound();
      }

      refreshBalance();

      // Emit event for other components to listen
      wsEvents.emit(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, event);
    },
    onServiceEvent: (event) => {
      // Handle service connection/disconnection events
      if (event.type === 'cloudflared:connected') {
        toast({
          title: `☁️ ${tt('cloudflareConnected')}`,
          description: tt('tunnelConnected'),
          variant: 'default',
        });
        addNotification({
          type: 'info',
          title: t('cloudflareConnected'),
          message: t('tunnelNowActive'),
          timestamp: Date.now(),
        });
      } else if (event.type === 'cloudflared:disconnected') {
        toast({
          title: `☁️ ${tt('cloudflareDisconnected')}`,
          description: tt('tunnelDisconnected'),
          variant: 'default',
        });
        addNotification({
          type: 'warning',
          title: t('cloudflareDisconnected'),
          message: t('tunnelStopped'),
          timestamp: Date.now(),
        });
      } else if (event.type === 'cloudflared:error') {
        toast({
          title: `☁️ ${tt('cloudflareError')}`,
          description: event.message || tt('tunnelError'),
          variant: 'destructive',
        });
        addNotification({
          type: 'error',
          title: t('cloudflareError'),
          message: event.message || t('tunnelFailed'),
          timestamp: Date.now(),
        });
      }
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
    <div className="premium-bg flex h-screen min-w-[320px] overflow-hidden pt-safe">
      {/* PWA: Status bar fill for Dynamic Island/Notch - matches background */}
      <div className="status-bar-fill" />

      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block overflow-hidden">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="relative flex flex-1 flex-col overflow-auto mobile-scrollbar-hide">
        {/* Header - Sticky */}
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
        <main className="flex-1 px-4 md:px-8 pb-24 md:pb-8">
          <div className="relative z-10">{children}</div>
        </main>
      </div>

      {/* Bottom Navigation - Only on mobile */}
      <BottomNav />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      <Toaster />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <AnimationProvider>
          <DashboardContent>{children}</DashboardContent>
        </AnimationProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}
