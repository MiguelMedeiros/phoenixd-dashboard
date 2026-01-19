'use client';

import { useTranslations } from 'next-intl';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface StepLanguageProps {
  value: string;
  onChange: (value: string) => void;
  onLocaleChange?: (locale: string) => void;
}

export function StepLanguage({ value, onChange, onLocaleChange }: StepLanguageProps) {
  const t = useTranslations('setup.language');

  const handleLanguageChange = (locale: string) => {
    onChange(locale);

    // Notify parent to handle locale change without navigation
    if (onLocaleChange) {
      onLocaleChange(locale);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-slate-600 dark:text-white/60 text-sm">{t('description')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {locales.map((locale) => {
          const isSelected = value === locale;

          return (
            <button
              key={locale}
              onClick={() => handleLanguageChange(locale)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                isSelected
                  ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/5'
                  : 'border-slate-200 dark:border-white/10 hover:border-orange-400 hover:bg-slate-50 dark:hover:bg-white/5'
              )}
            >
              <span className="text-2xl">{localeFlags[locale as Locale]}</span>
              <span className={cn('font-medium text-sm', isSelected && 'text-orange-500')}>
                {localeNames[locale as Locale]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
