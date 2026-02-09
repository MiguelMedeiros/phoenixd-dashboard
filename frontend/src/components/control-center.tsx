'use client';

import { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal,
  Blocks,
  Zap,
  Activity,
  RefreshCw,
  ExternalLink,
  Shield,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  Server,
  Container,
  Globe,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMempoolData } from '@/hooks/use-mempool-data';
import { getCongestionLevel, formatBlockHeight, formatFeeRate } from '@/lib/mempool';
import {
  getTorStatus,
  getTailscaleStatus,
  getCloudflaredStatus,
  getPhoenixdConnections,
  activatePhoenixdConnection,
  type TorStatus,
  type TailscaleStatus,
  type CloudflaredStatus,
  type PhoenixdConnection,
} from '@/lib/api';
import { useDesktopMode } from '@/hooks/use-desktop-mode';
import {
  useCurrencyContext,
  FIAT_CURRENCIES,
  type FiatCurrencyCode,
} from '@/components/currency-provider';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

// ── Helpers ──────────────────────────────────────────────

type ServiceStatus = 'healthy' | 'starting' | 'disabled' | 'error';

function getServiceStatus(
  enabled: boolean | undefined,
  running: boolean | undefined,
  healthy: boolean | undefined
): ServiceStatus {
  if (!enabled) return 'disabled';
  if (healthy) return 'healthy';
  if (running) return 'starting';
  return 'error';
}

function getStatusDotColor(status: ServiceStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-success';
    case 'starting':
      return 'bg-warning animate-pulse';
    case 'disabled':
      return 'bg-muted-foreground/30';
    case 'error':
      return 'bg-destructive';
  }
}

function getStatusTextColor(status: ServiceStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-success';
    case 'starting':
      return 'text-warning';
    case 'disabled':
      return 'text-muted-foreground';
    case 'error':
      return 'text-destructive';
  }
}

// ── Component ────────────────────────────────────────────

interface ControlCenterProps {
  className?: string;
}

export function ControlCenter({ className }: ControlCenterProps) {
  const t = useTranslations('common');
  const tn = useTranslations('network');
  const ts = useTranslations('settings');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const routerPathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Bitcoin Network ──
  const {
    data: mempoolData,
    loading: mempoolLoading,
    error: mempoolError,
    refresh: mempoolRefresh,
  } = useMempoolData();
  const fees = mempoolData?.fees;
  const blockHeight = mempoolData?.blockHeight;
  const congestionLevel = fees ? getCongestionLevel(fees) : 'low';

  // ── Network Services ──
  const { isDesktopMode } = useDesktopMode();
  const [torStatus, setTorStatus] = useState<TorStatus | null>(null);
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus | null>(null);
  const [cloudflaredStatus, setCloudflaredStatus] = useState<CloudflaredStatus | null>(null);
  const [networkLoading, setNetworkLoading] = useState(true);

  // ── Connections ──
  const [connections, setConnections] = useState<PhoenixdConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  // ── Currency ──
  const { currency, setCurrency } = useCurrencyContext();
  const currentCurrency = FIAT_CURRENCIES.find((c) => c.code === currency) || FIAT_CURRENCIES[0];

  // ── Fetch network status ──
  useEffect(() => {
    if (isDesktopMode) {
      setNetworkLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const [tor, tailscale, cloudflared] = await Promise.all([
          getTorStatus().catch(() => null),
          getTailscaleStatus().catch(() => null),
          getCloudflaredStatus().catch(() => null),
        ]);
        setTorStatus(tor);
        setTailscaleStatus(tailscale);
        setCloudflaredStatus(cloudflared);
      } finally {
        setNetworkLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [isDesktopMode]);

  // ── Fetch connections ──
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const data = await getPhoenixdConnections();
        setConnections(data);
      } catch (error) {
        console.error('Failed to fetch connections:', error);
      } finally {
        setConnectionsLoading(false);
      }
    };

    fetchConnections();
  }, []);

  // ── Close panel on click outside ──
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedSection(null);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ── Derived status ──
  const torServiceStatus = getServiceStatus(
    torStatus?.enabled,
    torStatus?.running,
    torStatus?.healthy
  );
  const tailscaleServiceStatus = getServiceStatus(
    tailscaleStatus?.enabled,
    tailscaleStatus?.running,
    tailscaleStatus?.healthy
  );
  const cloudflaredServiceStatus = getServiceStatus(
    cloudflaredStatus?.enabled,
    cloudflaredStatus?.running,
    cloudflaredStatus?.healthy
  );

  const getOverallStatus = (): ServiceStatus => {
    const statuses = [torServiceStatus, tailscaleServiceStatus, cloudflaredServiceStatus];
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('starting')) return 'starting';
    if (statuses.includes('healthy')) return 'healthy';
    return 'disabled';
  };

  const overallStatus = isDesktopMode ? 'disabled' : getOverallStatus();

  const getCongestionColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'text-success';
      case 'medium':
        return 'text-warning';
      case 'high':
        return 'text-destructive';
    }
  };

  const getServiceStatusLabel = (status: ServiceStatus): string => {
    switch (status) {
      case 'healthy':
        return t('connected');
      case 'starting':
        return t('connecting');
      case 'disabled':
        return t('disabled');
      case 'error':
        return t('error');
    }
  };

  const handleActivateConnection = async (connection: PhoenixdConnection) => {
    if (connection.isActive) return;

    setActivating(connection.id);
    window.dispatchEvent(new CustomEvent('phoenixd:connection-changing'));
    try {
      await activatePhoenixdConnection(connection.id);
      const data = await getPhoenixdConnections();
      setConnections(data);
      window.dispatchEvent(new CustomEvent('phoenixd:connection-changed'));
    } catch (error) {
      console.error('Failed to activate connection:', error);
      window.dispatchEvent(new CustomEvent('phoenixd:connection-changed'));
    } finally {
      setActivating(null);
    }
  };

  const handleCurrencyChange = (code: FiatCurrencyCode) => {
    setCurrency(code);
    setExpandedSection(null);
  };

  const handleLocaleChange = (newLocale: Locale) => {
    router.replace(routerPathname, { locale: newLocale });
    setExpandedSection(null);
    setIsOpen(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const showNetworkServices = !isDesktopMode;
  const showConnections = !connectionsLoading && connections.length > 1;

  const mempoolUrl = 'https://mempool.space';

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setExpandedSection(null);
        }}
        className="icon-circle !w-9 !h-9 md:!w-11 md:!h-11 relative group"
        title={t('controlCenter') || 'Control Center'}
      >
        <SlidersHorizontal className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        {/* Overall status dot */}
        {!networkLoading && overallStatus !== 'disabled' && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2 w-2 md:h-3 md:w-3 rounded-full border-2 border-background',
              getStatusDotColor(overallStatus)
            )}
          />
        )}
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setExpandedSection(null);
            }}
          />

          {/* Dropdown panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-[340px] md:w-[380px]">
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/[0.08] animate-scale-in origin-top-right">
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
                <h3 className="font-semibold text-sm">{t('controlCenter') || 'Control Center'}</h3>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setExpandedSection(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* ── Scrollable Content ── */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* ━━ Bitcoin Network Section ━━ */}
                <div className="p-4 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tn('title')}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        mempoolRefresh();
                      }}
                      disabled={mempoolLoading}
                      className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <RefreshCw
                        className={cn(
                          'h-3.5 w-3.5 text-muted-foreground',
                          mempoolLoading && 'animate-spin'
                        )}
                      />
                    </button>
                  </div>

                  {mempoolError && !mempoolData ? (
                    <div className="text-center py-3">
                      <p className="text-xs text-muted-foreground mb-1">{tn('unavailable')}</p>
                      <button
                        onClick={mempoolRefresh}
                        className="text-xs text-primary hover:underline"
                      >
                        {tn('retry')}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                          <div className="flex items-center gap-1 mb-1">
                            <Blocks className="h-3 w-3 text-bitcoin" />
                            <span className="text-[10px] text-muted-foreground">
                              {tn('blockHeight')}
                            </span>
                          </div>
                          <p className="font-mono text-xs font-semibold">
                            {blockHeight ? formatBlockHeight(blockHeight) : '--'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                          <div className="flex items-center gap-1 mb-1">
                            <Zap className="h-3 w-3 text-primary" />
                            <span className="text-[10px] text-muted-foreground">{tn('fast')}</span>
                          </div>
                          <p className="font-mono text-xs font-semibold">
                            {fees ? formatFeeRate(fees.fastestFee) : '--'}
                            <span className="text-[9px] text-muted-foreground ml-0.5">s/vB</span>
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                          <div className="flex items-center gap-1 mb-1">
                            <Activity className="h-3 w-3 text-blue-500" />
                            <span className="text-[10px] text-muted-foreground">
                              {tn('congestion')}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-xs font-semibold',
                              getCongestionColor(congestionLevel)
                            )}
                          >
                            {tn(`congestion_${congestionLevel}`)}
                          </p>
                        </div>
                      </div>

                      <a
                        href={mempoolUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        mempool.space <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </>
                  )}
                </div>

                {/* ━━ Network Services Section ━━ */}
                {showNetworkServices && (
                  <div className="p-4 border-b border-black/5 dark:border-white/5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      {t('networkStatus')}
                    </p>

                    {networkLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {/* Tor */}
                        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
                          <Shield className={cn('h-4 w-4', getStatusTextColor(torServiceStatus))} />
                          <span className="text-sm flex-1">Tor</span>
                          <span className={cn('text-xs', getStatusTextColor(torServiceStatus))}>
                            {getServiceStatusLabel(torServiceStatus)}
                          </span>
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full flex-shrink-0',
                              getStatusDotColor(torServiceStatus)
                            )}
                          />
                        </div>

                        {/* Tailscale */}
                        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
                          {tailscaleServiceStatus === 'disabled' ? (
                            <WifiOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Wifi
                              className={cn('h-4 w-4', getStatusTextColor(tailscaleServiceStatus))}
                            />
                          )}
                          <span className="text-sm flex-1">Tailscale</span>
                          <span
                            className={cn('text-xs', getStatusTextColor(tailscaleServiceStatus))}
                          >
                            {tailscaleStatus?.dnsName ||
                              getServiceStatusLabel(tailscaleServiceStatus)}
                          </span>
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full flex-shrink-0',
                              getStatusDotColor(tailscaleServiceStatus)
                            )}
                          />
                        </div>

                        {/* Cloudflare */}
                        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
                          {cloudflaredServiceStatus === 'disabled' ? (
                            <CloudOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Cloud
                              className={cn(
                                'h-4 w-4',
                                getStatusTextColor(cloudflaredServiceStatus)
                              )}
                            />
                          )}
                          <span className="text-sm flex-1">Cloudflare</span>
                          <span
                            className={cn(
                              'text-xs truncate max-w-[120px]',
                              getStatusTextColor(cloudflaredServiceStatus)
                            )}
                          >
                            {cloudflaredStatus?.ingress &&
                            cloudflaredStatus.ingress.length > 0 &&
                            cloudflaredServiceStatus === 'healthy'
                              ? cloudflaredStatus.ingress[0].hostname
                              : getServiceStatusLabel(cloudflaredServiceStatus)}
                          </span>
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full flex-shrink-0',
                              getStatusDotColor(cloudflaredServiceStatus)
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <Link
                      href="/settings#network"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-2"
                    >
                      {t('manageNetwork')} <ChevronRight className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                )}

                {/* ━━ Connection Section ━━ */}
                {showConnections && (
                  <div className="p-4 border-b border-black/5 dark:border-white/5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      {ts('nodeConnection')}
                    </p>

                    <div className="space-y-1">
                      {connections.map((conn) => (
                        <button
                          key={conn.id}
                          onClick={() => handleActivateConnection(conn)}
                          disabled={activating !== null}
                          className={cn(
                            'w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left',
                            'hover:bg-black/5 dark:hover:bg-white/5',
                            conn.isActive && 'bg-primary/5',
                            activating !== null && !conn.isActive && 'opacity-50'
                          )}
                        >
                          {conn.isDocker ? (
                            <Container className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Server className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{conn.name}</p>
                            {conn.chain && (
                              <p className="text-[11px] text-muted-foreground">{conn.chain}</p>
                            )}
                          </div>
                          {activating === conn.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : conn.isActive ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : null}
                        </button>
                      ))}
                    </div>

                    <Link
                      href="/settings#network"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-2"
                    >
                      {t('manageConnections')} <ChevronRight className="h-2.5 w-2.5" />
                    </Link>
                  </div>
                )}

                {/* ━━ Preferences Section ━━ */}
                <div className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    {t('preferences') || 'Preferences'}
                  </p>

                  {/* Currency */}
                  <button
                    onClick={() => toggleSection('currency')}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="text-base font-bold text-primary w-5 text-center">
                      {currentCurrency.symbol}
                    </span>
                    <span className="text-sm flex-1 text-left">{ts('currency') || 'Currency'}</span>
                    <span className="text-xs text-muted-foreground">{currentCurrency.code}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-muted-foreground transition-transform',
                        expandedSection === 'currency' && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Currency Options */}
                  {expandedSection === 'currency' && (
                    <div className="ml-8 mt-1 mb-2 max-h-48 overflow-y-auto rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                      {FIAT_CURRENCIES.map((curr) => (
                        <button
                          key={curr.code}
                          onClick={() => handleCurrencyChange(curr.code)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                            'hover:bg-black/5 dark:hover:bg-white/5',
                            currency === curr.code && 'bg-primary/10'
                          )}
                        >
                          <span className="text-sm font-bold w-6 text-primary text-right">
                            {curr.symbol}
                          </span>
                          <span className="text-sm flex-1">{curr.code}</span>
                          {currency === curr.code && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Language */}
                  <button
                    onClick={() => toggleSection('language')}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 text-left">{ts('language')}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{localeFlags[locale]}</span>
                      {localeNames[locale]}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-muted-foreground transition-transform',
                        expandedSection === 'language' && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Language Options */}
                  {expandedSection === 'language' && (
                    <div className="ml-8 mt-1 mb-2 max-h-48 overflow-y-auto rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                      {locales.map((loc) => (
                        <button
                          key={loc}
                          onClick={() => handleLocaleChange(loc)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            'hover:bg-black/5 dark:hover:bg-white/5',
                            locale === loc && 'bg-primary/10'
                          )}
                        >
                          <span className="text-lg">{localeFlags[loc]}</span>
                          <span className="text-sm flex-1">{localeNames[loc]}</span>
                          {locale === loc && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="px-4 py-3 border-t border-black/10 dark:border-white/10">
                <Link
                  href="/settings"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-primary hover:underline"
                >
                  {t('settings')} <ChevronRight className="h-2.5 w-2.5 inline" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
