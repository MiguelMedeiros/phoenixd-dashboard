'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, Wifi, WifiOff, Network, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTorStatus, getTailscaleStatus, type TorStatus, type TailscaleStatus } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

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

function getStatusColor(status: ServiceStatus): string {
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

export function NetworkStatusButton() {
  const t = useTranslations('common');
  const [isOpen, setIsOpen] = useState(false);
  const [torStatus, setTorStatus] = useState<TorStatus | null>(null);
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch network status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [tor, tailscale] = await Promise.all([
          getTorStatus().catch(() => null),
          getTailscaleStatus().catch(() => null),
        ]);
        setTorStatus(tor);
        setTailscaleStatus(tailscale);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

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

  // Overall status - show worst status
  const getOverallStatus = (): ServiceStatus => {
    const statuses = [torServiceStatus, tailscaleServiceStatus];
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('starting')) return 'starting';
    if (statuses.includes('healthy')) return 'healthy';
    return 'disabled';
  };

  const overallStatus = getOverallStatus();

  const getStatusLabel = (status: ServiceStatus): string => {
    switch (status) {
      case 'healthy':
        return t('networkHealthy');
      case 'starting':
        return t('networkStarting');
      case 'disabled':
        return t('networkDisabled');
      case 'error':
        return t('networkError');
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="icon-circle !w-9 !h-9 md:!w-11 md:!h-11 relative group"
        title={getStatusLabel(overallStatus)}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground animate-spin" />
        ) : (
          <Network className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
        {/* Status indicator dot */}
        {!loading && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 md:h-3 md:w-3 rounded-full border-2 border-background',
              getStatusColor(overallStatus)
            )}
          />
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute py-3 w-64 rounded-xl bg-background/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95',
            'right-0 mt-2 slide-in-from-top-2'
          )}
        >
          <div className="px-4 pb-3 mb-2 border-b border-white/5">
            <p className="text-sm font-medium">{t('networkStatus')}</p>
          </div>

          {/* Tor Status */}
          <div className="px-4 py-2.5 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center',
                  torServiceStatus === 'healthy'
                    ? 'bg-success/10'
                    : torServiceStatus === 'starting'
                      ? 'bg-warning/10'
                      : torServiceStatus === 'error'
                        ? 'bg-destructive/10'
                        : 'bg-muted/50'
                )}
              >
                <Shield
                  className={cn(
                    'h-4 w-4',
                    torServiceStatus === 'healthy'
                      ? 'text-success'
                      : torServiceStatus === 'starting'
                        ? 'text-warning'
                        : torServiceStatus === 'error'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Tor</p>
                <p
                  className={cn(
                    'text-xs',
                    torServiceStatus === 'healthy'
                      ? 'text-success'
                      : torServiceStatus === 'starting'
                        ? 'text-warning'
                        : torServiceStatus === 'error'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                  )}
                >
                  {getServiceStatusLabel(torServiceStatus)}
                </p>
              </div>
              <div className={cn('h-2.5 w-2.5 rounded-full', getStatusColor(torServiceStatus))} />
            </div>
          </div>

          {/* Tailscale Status */}
          <div className="px-4 py-2.5 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center',
                  tailscaleServiceStatus === 'healthy'
                    ? 'bg-success/10'
                    : tailscaleServiceStatus === 'starting'
                      ? 'bg-warning/10'
                      : tailscaleServiceStatus === 'error'
                        ? 'bg-destructive/10'
                        : 'bg-muted/50'
                )}
              >
                {tailscaleServiceStatus === 'disabled' ? (
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Wifi
                    className={cn(
                      'h-4 w-4',
                      tailscaleServiceStatus === 'healthy'
                        ? 'text-success'
                        : tailscaleServiceStatus === 'starting'
                          ? 'text-warning'
                          : 'text-destructive'
                    )}
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Tailscale</p>
                <p
                  className={cn(
                    'text-xs',
                    tailscaleServiceStatus === 'healthy'
                      ? 'text-success'
                      : tailscaleServiceStatus === 'starting'
                        ? 'text-warning'
                        : tailscaleServiceStatus === 'error'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                  )}
                >
                  {tailscaleStatus?.dnsName
                    ? tailscaleStatus.dnsName
                    : getServiceStatusLabel(tailscaleServiceStatus)}
                </p>
              </div>
              <div
                className={cn('h-2.5 w-2.5 rounded-full', getStatusColor(tailscaleServiceStatus))}
              />
            </div>
          </div>

          {/* Settings Link */}
          <div className="px-4 pt-3 mt-2 border-t border-white/5">
            <Link
              href="/settings#network"
              onClick={() => setIsOpen(false)}
              className="text-xs text-primary hover:underline"
            >
              {t('manageNetwork')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
