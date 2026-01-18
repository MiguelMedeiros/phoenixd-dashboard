'use client';

import { useTranslations } from 'next-intl';
import { Check, Shield, Languages, Palette, Server, Globe, Package } from 'lucide-react';
import { localeNames, localeFlags, type Locale } from '@/i18n/routing';
import type { PhoenixdConfig } from './step-phoenixd';
import type { NetworkConfig } from './step-network';
import type { AppsConfig } from './step-apps';
import type { ProfileType } from './step-profile';

interface WizardState {
  profile: ProfileType;
  password: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  phoenixd: PhoenixdConfig;
  network: NetworkConfig;
  apps: AppsConfig;
}

interface StepReviewProps {
  config: WizardState;
}

export function StepReview({ config }: StepReviewProps) {
  const t = useTranslations('setup.review');

  // Get network summary
  const getNetworkValue = (): string => {
    const services: string[] = [];
    if (config.network.tailscale?.enabled) services.push('Tailscale');
    if (config.network.cloudflared?.enabled) services.push('Cloudflare Tunnel');
    if (config.network.tor?.enabled) services.push('Tor');
    if (services.length === 0) return t('networkNone');
    return services.join(', ');
  };

  // Get apps summary
  const getAppsValue = (): string => {
    const enabled = Object.entries(config.apps)
      .filter(([, value]) => value)
      .map(([key]) => key);
    if (enabled.length === 0) return t('appsNone');
    if (enabled.includes('donations')) return t('appsDonations');
    return t('appsCount', { count: enabled.length });
  };

  const sections = [
    {
      icon: Shield,
      title: t('password'),
      value: t('passwordSet'),
      enabled: true,
    },
    {
      icon: Languages,
      title: t('language'),
      value: `${localeFlags[config.locale as Locale] || ''} ${localeNames[config.locale as Locale] || config.locale}`,
      enabled: true,
    },
    {
      icon: Palette,
      title: t('theme'),
      value: t(`themes.${config.theme}`),
      enabled: true,
    },
    {
      icon: Server,
      title: t('phoenixd'),
      value:
        config.phoenixd.type === 'docker'
          ? t('phoenixdDocker')
          : t('phoenixdExternal', { count: config.phoenixd.connections.length }),
      enabled: true,
    },
    {
      icon: Globe,
      title: t('network'),
      value: getNetworkValue(),
      enabled:
        config.network.tailscale?.enabled ||
        config.network.cloudflared?.enabled ||
        config.network.tor?.enabled,
    },
    {
      icon: Package,
      title: t('apps'),
      value: getAppsValue(),
      enabled: Object.values(config.apps).some((v) => v),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <div
              key={section.title}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{section.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{section.value}</p>
              </div>
              <Check className="h-5 w-5 text-success flex-shrink-0" />
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
        <p className="text-sm text-success text-center">{t('ready')}</p>
      </div>
    </div>
  );
}
