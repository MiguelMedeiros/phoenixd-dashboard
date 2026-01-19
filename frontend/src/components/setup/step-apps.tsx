'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Heart, Loader2, Package } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getAvailableApps, type AvailableApp } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface AppsConfig {
  donations?: boolean;
  [key: string]: boolean | undefined;
}

interface StepAppsProps {
  value: AppsConfig;
  onChange: (value: AppsConfig) => void;
}

// Icon mapping for apps
const appIcons: Record<string, typeof Heart> = {
  donations: Heart,
};

export function StepApps({ value, onChange }: StepAppsProps) {
  const t = useTranslations('setup.apps');
  const [apps, setApps] = useState<AvailableApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApps() {
      try {
        const availableApps = await getAvailableApps();
        setApps(availableApps);
      } catch (error) {
        console.error('Error fetching apps:', error);
        // Fallback to default apps
        setApps([
          {
            slug: 'donations',
            name: 'Donations Page',
            description: 'Beautiful donation page to accept Lightning payments',
            icon: '💜',
            recommended: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchApps();
  }, []);

  const toggleApp = (slug: string, enabled: boolean) => {
    onChange({
      ...value,
      [slug]: enabled,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-slate-600 dark:text-white/60 text-sm">{t('description')}</p>
      </div>

      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="h-12 w-12 text-slate-400 dark:text-white/40 mb-4" />
          <p className="text-slate-500 dark:text-white/50">{t('noApps')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => {
            const Icon = appIcons[app.slug] || Package;
            const isEnabled = value[app.slug] ?? app.recommended;

            return (
              <div
                key={app.slug}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                  isEnabled
                    ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/5'
                    : 'border-slate-200 dark:border-white/10'
                )}
              >
                <div
                  className={cn(
                    'h-12 w-12 rounded-xl flex items-center justify-center text-2xl',
                    isEnabled ? 'bg-orange-500/20' : 'bg-slate-100 dark:bg-white/10'
                  )}
                >
                  {app.icon || <Icon className="h-6 w-6" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{app.name}</h3>
                    {app.recommended && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full">
                        {t('recommended')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-white/60">{app.description}</p>
                </div>

                <Switch
                  checked={isEnabled}
                  onCheckedChange={(enabled) => toggleApp(app.slug, enabled)}
                />
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-white/50 text-center">{t('canChangeLater')}</p>
    </div>
  );
}
