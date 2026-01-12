'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  Search,
  Bell,
  Menu,
  X,
  Home,
  History,
  Layers,
  Wrench,
  Link2,
  Settings,
  Globe,
  DollarSign,
  Users,
} from 'lucide-react';
import { getBalance } from '@/lib/api';
import { useAuthContext } from '@/components/auth-provider';
import { useCurrencyContext } from '@/components/currency-provider';
import { cn } from '@/lib/utils';
import { SearchDialog } from '@/components/search-dialog';
import { NotificationsPopover, type Notification } from '@/components/notifications-popover';
import { LanguageSwitcher } from '@/components/language-switcher';
import { CurrencySwitcher } from '@/components/currency-switcher';
import { NetworkStatusButton } from '@/components/network-status-button';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

// Navigation items for mobile drawer
const mobileNavItems = [
  { key: 'overview', href: '/', icon: Home },
  { key: 'contacts', href: '/contacts', icon: Users },
  { key: 'payments', href: '/payments', icon: History },
  { key: 'channels', href: '/channels', icon: Layers },
  { key: 'tools', href: '/tools', icon: Wrench },
  { key: 'lnurl', href: '/lnurl', icon: Link2 },
  { key: 'settings', href: '/settings', icon: Settings },
];

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
  title,
  subtitle,
  notifications = [],
  onNotificationRead,
  onNotificationsMarkAllRead,
  onNotificationsClear,
  onNotificationRemove,
}: HeaderProps) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const [balance, setBalance] = useState<{
    balanceSat: number;
    feeCreditSat: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceAnimating, setBalanceAnimating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useAuthContext(); // Keep auth context active for session management
  const { formatValueParts, bitcoinDisplayMode, setBitcoinDisplayMode, currency } =
    useCurrencyContext();

  const displayTitle = title || t('dashboard');

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
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed top-0 left-0 bottom-0 w-72 z-50 md:hidden">
          <div className="h-full bg-background/95 backdrop-blur-xl border-r border-white/10 p-4 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="icon-circle !w-9 !h-9 !bg-gradient-to-br !from-primary/20 !to-accent/20">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold">Phoenixd</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
              {mobileNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                      isActive
                        ? 'bg-primary text-white'
                        : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{t(item.key)}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Currency & Language Switchers */}
            <div className="border-t border-white/10 pt-4 mt-4 space-y-2">
              <div className="flex items-center gap-3 px-4 py-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <CurrencySwitcher openUp />
              </div>
              <div className="flex items-center gap-3 px-4 py-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <LanguageSwitcher openUp />
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 py-3 md:py-6 bg-background/80 backdrop-blur-xl border-b border-white/5">
        {/* Left - Menu Button (mobile) / Title (desktop) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden icon-circle !w-9 !h-9 group"
          >
            <Menu className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          {/* Desktop: Title only */}
          <div className="hidden md:block">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{displayTitle}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Currency Switcher - Hidden on mobile and small tablets */}
          <div className="hidden lg:block">
            <CurrencySwitcher />
          </div>

          {/* Language Switcher - Hidden on mobile and small tablets */}
          <div className="hidden lg:block">
            <LanguageSwitcher />
          </div>

          {/* Search - Hidden on mobile and small tablets */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden lg:flex icon-circle group"
            title={t('search')}
          >
            <Search className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Network Status - Tor and Tailscale */}
          <NetworkStatusButton />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="icon-circle !w-9 !h-9 md:!w-11 md:!h-11 relative group"
              title="Notifications"
            >
              <Bell className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary text-[10px] font-bold text-white border-2 border-background">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {unreadCount === 0 && isConnected && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 md:h-3 md:w-3 rounded-full bg-success border-2 border-background" />
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

          {/* Balance Pill - Click to toggle display mode (BTC) or refresh (fiat) */}
          {balance &&
            (() => {
              const parts = formatValueParts(balance.balanceSat);
              const isBip177 = currency === 'BTC' && bitcoinDisplayMode === 'bip177';

              const handleBalanceClick = () => {
                if (currency === 'BTC') {
                  // Toggle between sats and bip177 display modes
                  setBitcoinDisplayMode(bitcoinDisplayMode === 'sats' ? 'bip177' : 'sats');
                } else {
                  // For fiat currencies, refresh the balance
                  handleRefresh();
                }
              };

              return (
                <button
                  onClick={handleBalanceClick}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-full glass-card hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-70 border border-primary/20"
                >
                  {/* Show Zap icon only for classic sats mode, not for BIP-177 to avoid symbol overload */}
                  {!isBip177 && (
                    <div className="relative flex items-center justify-center">
                      <Zap
                        className={cn(
                          'h-4 w-4 md:h-5 md:w-5 text-primary',
                          loading && 'animate-pulse'
                        )}
                      />
                    </div>
                  )}
                  <span
                    className={cn(
                      'font-mono text-sm md:text-base font-bold transition-transform flex items-baseline gap-1',
                      balanceAnimating && 'scale-110'
                    )}
                  >
                    {isBip177 ? (
                      <>
                        <span className="text-primary">{parts.unit}</span>
                        <span className="value-highlight">{parts.value}</span>
                      </>
                    ) : currency === 'BTC' ? (
                      <>
                        <span className="value-highlight">{parts.value}</span>
                        <span className="text-muted-foreground font-normal text-xs">
                          {parts.unit}
                        </span>
                      </>
                    ) : (
                      <span className="value-highlight">{parts.full}</span>
                    )}
                  </span>
                </button>
              );
            })()}
        </div>
      </header>

      {/* Search Dialog */}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
