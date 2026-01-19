'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepThemeProps {
  value: 'light' | 'dark' | 'system';
  onChange: (value: 'light' | 'dark' | 'system') => void;
}

const themes: Array<{
  id: 'light' | 'dark' | 'system';
  icon: typeof Sun;
}> = [
  { id: 'light', icon: Sun },
  { id: 'dark', icon: Moon },
  { id: 'system', icon: Monitor },
];

export function StepTheme({ value, onChange }: StepThemeProps) {
  const t = useTranslations('setup.theme');
  const { setTheme } = useTheme();

  // Apply theme preview when value changes
  useEffect(() => {
    setTheme(value);
  }, [value, setTheme]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-slate-600 dark:text-white/60 text-sm">{t('description')}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isSelected = value === theme.id;

          return (
            <button
              key={theme.id}
              onClick={() => onChange(theme.id)}
              className={cn(
                'flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
                isSelected
                  ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/5'
                  : 'border-slate-200 dark:border-white/10 hover:border-orange-400 hover:bg-slate-50 dark:hover:bg-white/5'
              )}
            >
              <div
                className={cn(
                  'h-14 w-14 rounded-xl flex items-center justify-center',
                  isSelected ? 'bg-orange-500/20' : 'bg-slate-100 dark:bg-white/10'
                )}
              >
                <Icon
                  className={cn(
                    'h-7 w-7',
                    isSelected ? 'text-orange-500' : 'text-slate-500 dark:text-white/60'
                  )}
                />
              </div>
              <span className={cn('font-medium', isSelected && 'text-orange-500')}>
                {t(theme.id)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 dark:text-white/50 text-center">{t('preview')}</p>
    </div>
  );
}
