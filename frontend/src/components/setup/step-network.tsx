'use client';

import { useTranslations } from 'next-intl';
import { Cloud, Globe, Shield, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface NetworkConfig {
  tailscale?: {
    enabled: boolean;
    authKey?: string;
    hostname?: string;
  };
  cloudflared?: {
    enabled: boolean;
    token?: string;
  };
  tor?: {
    enabled: boolean;
  };
}

interface StepNetworkProps {
  value: NetworkConfig;
  onChange: (value: NetworkConfig) => void;
}

export function StepNetwork({ value, onChange }: StepNetworkProps) {
  const t = useTranslations('setup.network');

  const updateTailscale = (updates: Partial<NetworkConfig['tailscale']>) => {
    onChange({
      ...value,
      tailscale: { ...value.tailscale, enabled: false, ...updates },
    });
  };

  const updateCloudflared = (updates: Partial<NetworkConfig['cloudflared']>) => {
    onChange({
      ...value,
      cloudflared: { ...value.cloudflared, enabled: false, ...updates },
    });
  };

  const updateTor = (updates: Partial<NetworkConfig['tor']>) => {
    onChange({
      ...value,
      tor: { ...value.tor, enabled: false, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-slate-600 dark:text-white/60 text-sm">{t('description')}</p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <Info className="h-5 w-5 text-slate-500 dark:text-white/50 flex-shrink-0" />
        <p className="text-sm text-slate-600 dark:text-white/60">{t('optional')}</p>
      </div>

      <div className="space-y-4">
        {/* Tailscale */}
        <div
          className={cn(
            'p-4 rounded-xl border-2 transition-all',
            value.tailscale?.enabled
              ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/5'
              : 'border-slate-200 dark:border-white/10'
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center',
                  value.tailscale?.enabled ? 'bg-orange-500/20' : 'bg-slate-100 dark:bg-white/10'
                )}
              >
                <Globe
                  className={cn(
                    'h-5 w-5',
                    value.tailscale?.enabled
                      ? 'text-orange-500'
                      : 'text-slate-500 dark:text-white/60'
                  )}
                />
              </div>
              <div>
                <h3 className="font-medium">{t('tailscale.title')}</h3>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  {t('tailscale.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={value.tailscale?.enabled ?? false}
              onCheckedChange={(enabled) => updateTailscale({ enabled })}
            />
          </div>

          {value.tailscale?.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
              <div className="space-y-1.5">
                <Label htmlFor="tailscale-authkey">{t('tailscale.authKeyLabel')}</Label>
                <Input
                  id="tailscale-authkey"
                  type="password"
                  value={value.tailscale?.authKey ?? ''}
                  onChange={(e) => updateTailscale({ authKey: e.target.value })}
                  placeholder={t('tailscale.authKeyPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tailscale-hostname">{t('tailscale.hostnameLabel')}</Label>
                <Input
                  id="tailscale-hostname"
                  value={value.tailscale?.hostname ?? ''}
                  onChange={(e) => updateTailscale({ hostname: e.target.value })}
                  placeholder="phoenixd-dashboard"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cloudflared */}
        <div
          className={cn(
            'p-4 rounded-xl border-2 transition-all',
            value.cloudflared?.enabled
              ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/5'
              : 'border-slate-200 dark:border-white/10'
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center',
                  value.cloudflared?.enabled ? 'bg-orange-500/20' : 'bg-slate-100 dark:bg-white/10'
                )}
              >
                <Cloud
                  className={cn(
                    'h-5 w-5',
                    value.cloudflared?.enabled
                      ? 'text-orange-500'
                      : 'text-slate-500 dark:text-white/60'
                  )}
                />
              </div>
              <div>
                <h3 className="font-medium">{t('cloudflared.title')}</h3>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  {t('cloudflared.description')}
                </p>
              </div>
            </div>
            <Switch
              checked={value.cloudflared?.enabled ?? false}
              onCheckedChange={(enabled) => updateCloudflared({ enabled })}
            />
          </div>

          {value.cloudflared?.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
              <div className="space-y-1.5">
                <Label htmlFor="cloudflared-token">{t('cloudflared.tokenLabel')}</Label>
                <Input
                  id="cloudflared-token"
                  type="password"
                  value={value.cloudflared?.token ?? ''}
                  onChange={(e) => updateCloudflared({ token: e.target.value })}
                  placeholder={t('cloudflared.tokenPlaceholder')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tor */}
        <div
          className={cn(
            'p-4 rounded-xl border-2 transition-all',
            value.tor?.enabled
              ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/5'
              : 'border-slate-200 dark:border-white/10'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center',
                  value.tor?.enabled ? 'bg-orange-500/20' : 'bg-slate-100 dark:bg-white/10'
                )}
              >
                <Shield
                  className={cn(
                    'h-5 w-5',
                    value.tor?.enabled ? 'text-orange-500' : 'text-slate-500 dark:text-white/60'
                  )}
                />
              </div>
              <div>
                <h3 className="font-medium">{t('tor.title')}</h3>
                <p className="text-xs text-slate-500 dark:text-white/50">{t('tor.description')}</p>
              </div>
            </div>
            <Switch
              checked={value.tor?.enabled ?? false}
              onCheckedChange={(enabled) => updateTor({ enabled })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
