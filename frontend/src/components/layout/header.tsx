'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Zap, Search, Bell, Lock } from 'lucide-react';
import { getBalance } from '@/lib/api';
import { useAuthContext } from '@/components/auth-provider';
import { formatSats } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { SearchDialog } from '@/components/search-dialog';
import { NotificationsPopover, type Notification } from '@/components/notifications-popover';

interface HeaderProps {
  isConnected: boolean;
  onRefreshBalance?: () => void;
  title?: string;
  subtitle?: string;
  notifications?: Notification[];
  onNotificationRead?: (id: string) => void;
  onNotificationsMarkAllRead?: () => void;
  onNotificationsClear?: () => void;
  onNotificationRemove?: (id: string) => void;
}

export function Header({
  isConnected,
  onRefreshBalance,
  title = 'Dashboard',
  subtitle,
  notifications = [],
  onNotificationRead,
  onNotificationsMarkAllRead,
  onNotificationsClear,
  onNotificationRemove,
}: HeaderProps) {
  const [balance, setBalance] = useState<{
    balanceSat: number;
    feeCreditSat: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceAnimating, setBalanceAnimating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { hasPassword, lock } = useAuthContext();

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBalance();
      if (balance && data.balanceSat !== balance.balanceSat) {
        setBalanceAnimating(true);
        setTimeout(() => setBalanceAnimating(false), 300);
      }
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  }, [balance]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose refresh to parent
  useEffect(() => {
    if (onRefreshBalance) {
      onRefreshBalance();
    }
  }, [onRefreshBalance]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefresh = () => {
    fetchBalance();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6">
        {/* Left - Logo on mobile, Title on desktop */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile Logo */}
          <div className="md:hidden flex items-center gap-2">
            <div className="relative">
              <div className="icon-circle !w-10 !h-10 !bg-gradient-to-br !from-primary/20 !to-accent/20">
                <Zap className="h-5 w-5 text-primary" />
              </div>
            </div>
            <span className="font-bold text-lg">Phoenixd</span>
          </div>

          {/* Desktop Title */}
          <div className="hidden md:block">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Search - Hidden on mobile */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex icon-circle group"
            title="Search (⌘K)"
          >
            <Search className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Lock Button - Only visible if password is configured */}
          {hasPassword && (
            <button
              onClick={lock}
              className="icon-circle !w-10 !h-10 md:!w-11 md:!h-11 group"
              title="Lock Dashboard"
            >
              <Lock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="icon-circle !w-10 !h-10 md:!w-11 md:!h-11 relative group"
              title="Notifications"
            >
              <Bell className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-[10px] font-bold text-white border-2 border-background">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {unreadCount === 0 && isConnected && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-success border-2 border-background" />
              )}
            </button>

            <NotificationsPopover
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              notifications={notifications}
              onMarkAsRead={onNotificationRead || (() => {})}
              onMarkAllAsRead={onNotificationsMarkAllRead || (() => {})}
              onClear={onNotificationsClear || (() => {})}
              onRemove={onNotificationRemove || (() => {})}
            />
          </div>

          {/* Balance Pill */}
          {balance && (
            <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-2.5 rounded-full glass-card">
              <div className="relative flex items-center justify-center">
                <Zap className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <div className="absolute inset-0 blur-md hidden md:block">
                  <Zap className="h-5 w-5 text-primary opacity-40" />
                </div>
              </div>
              <span
                className={cn(
                  'font-mono text-sm md:text-lg font-bold value-highlight transition-transform',
                  balanceAnimating && 'scale-110'
                )}
              >
                {formatSats(balance.balanceSat)}
              </span>

              {/* Refresh - Hidden on mobile */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="hidden md:block ml-1 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <RefreshCw
                  className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')}
                />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Search Dialog */}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
