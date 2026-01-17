'use client';

import { useState, useEffect } from 'react';
import { Shield, Wifi, WifiOff, Network, Loader2, Cloud, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getTorStatus,
  getTailscaleStatus,
  getCloudflaredStatus,
  type TorStatus,
  type TailscaleStatus,
  type CloudflaredStatus,
} from '@/lib/api';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useDesktopMode } from '@/hooks/use-desktop-mode';
import { HeaderDropdown, HeaderDropdownItem } from '@/components/ui/header-dropdown';

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

function getIconColor(status: ServiceStatus): string {
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

export function NetworkStatusButton() {
  const t = useTranslations('common');
  const { isDesktopMode } = useDesktopMode();
  const [isOpen, setIsOpen] = useState(false);
  const [torStatus, setTorStatus] = useState<TorStatus | null>(null);
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus | null>(null);
  const [cloudflaredStatus, setCloudflaredStatus] = useState<CloudflaredStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch network status (skip in desktop mode)
  useEffect(() => {
    if (isDesktopMode) return;

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
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [isDesktopMode]);

  // Hide network status button in desktop mode
  if (isDesktopMode) {
    return null;
  }

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

  // Overall status - show worst status
  const getOverallStatus = (): ServiceStatus => {
    const statuses = [torServiceStatus, tailscaleServiceStatus, cloudflaredServiceStatus];
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
    <div className="relative">
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
              'absolute -top-0.5 -right-0.5 h-2 w-2 md:h-3 md:w-3 rounded-full border-2 border-background',
              getStatusColor(overallStatus)
            )}
          />
        )}
      </button>

      <HeaderDropdown
        open={isOpen}
        onOpenChange={setIsOpen}
        title={t('networkStatus')}
        width="sm"
        footer={
          <Link
            href="/settings#network"
            onClick={() => setIsOpen(false)}
            className="text-xs text-primary hover:underline"
          >
            {t('manageNetwork')} →
          </Link>
        }
      >
        <div className="py-1">
          {/* Tor Status */}
          <HeaderDropdownItem
            icon={
              <Shield className={cn('h-4 w-4', getIconColor(torServiceStatus))} />
            }
            title="Tor"
            subtitle={getServiceStatusLabel(torServiceStatus)}
            trailing={
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full flex-shrink-0',
                  getStatusColor(torServiceStatus)
                )}
              />
            }
          />

          {/* Tailscale Status */}
          <HeaderDropdownItem
            icon={
              tailscaleServiceStatus === 'disabled' ? (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Wifi className={cn('h-4 w-4', getIconColor(tailscaleServiceStatus))} />
              )
            }
            title="Tailscale"
            subtitle={
              tailscaleStatus?.dnsName
                ? tailscaleStatus.dnsName
                : getServiceStatusLabel(tailscaleServiceStatus)
            }
            trailing={
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full flex-shrink-0',
                  getStatusColor(tailscaleServiceStatus)
                )}
              />
            }
          />

          {/* Cloudflare Tunnel Status */}
          <HeaderDropdownItem
            icon={
              cloudflaredServiceStatus === 'disabled' ? (
                <CloudOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Cloud className={cn('h-4 w-4', getIconColor(cloudflaredServiceStatus))} />
              )
            }
            title="Cloudflare"
            subtitle={
              cloudflaredStatus?.ingress &&
              cloudflaredStatus.ingress.length > 0 &&
              cloudflaredServiceStatus === 'healthy'
                ? cloudflaredStatus.ingress[0].hostname
                : getServiceStatusLabel(cloudflaredServiceStatus)
            }
            trailing={
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full flex-shrink-0',
                  getStatusColor(cloudflaredServiceStatus)
                )}
              />
            }
          />
        </div>
      </HeaderDropdown>
    </div>
  );
}
