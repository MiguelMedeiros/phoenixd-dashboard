'use client';

import { useTranslations } from 'next-intl';
import { Zap, Rocket, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProfileType = 'minimal' | 'full' | 'custom';

interface StepProfileProps {
  value: ProfileType;
  onChange: (value: ProfileType) => void;
}

const profiles: Array<{
  id: ProfileType;
  icon: typeof Zap;
  recommended?: boolean;
}> = [
  { id: 'minimal', icon: Zap },
  { id: 'full', icon: Rocket, recommended: true },
  { id: 'custom', icon: Settings2 },
];

export function StepProfile({ value, onChange }: StepProfileProps) {
  const t = useTranslations('setup.profile');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-slate-600 dark:text-white/60 text-sm">{t('description')}</p>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile) => {
          const Icon = profile.icon;
          const isSelected = value === profile.id;

          return (
            <button
              key={profile.id}
              onClick={() => onChange(profile.id)}
              className={cn(
                'relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left',
                isSelected
                  ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/5'
                  : 'border-slate-200 dark:border-white/10 hover:border-orange-400 hover:bg-slate-50 dark:hover:bg-white/5'
              )}
            >
              {profile.recommended && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium bg-orange-500 text-white rounded-full">
                  {t('recommended')}
                </span>
              )}
              <div
                className={cn(
                  'flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center',
                  isSelected ? 'bg-orange-500/20' : 'bg-slate-100 dark:bg-white/10'
                )}
              >
                <Icon
                  className={cn(
                    'h-6 w-6',
                    isSelected ? 'text-orange-500' : 'text-slate-500 dark:text-white/60'
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium mb-1">{t(`${profile.id}.title`)}</h3>
                <p className="text-sm text-slate-600 dark:text-white/60">
                  {t(`${profile.id}.description`)}
                </p>
                <ul className="mt-2 text-xs text-slate-500 dark:text-white/50 space-y-1">
                  {(t.raw(`${profile.id}.features`) as string[]).map(
                    (feature: string, i: number) => (
                      <li key={i} className="flex items-center gap-1">
                        <span className="text-orange-500">-</span> {feature}
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div
                className={cn(
                  'flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                  isSelected
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-slate-300 dark:border-white/30'
                )}
              >
                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
