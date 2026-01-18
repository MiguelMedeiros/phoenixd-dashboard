'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface StepLanguageProps {
  value: string;
  onChange: (value: string) => void;
}

export function StepLanguage({ value, onChange }: StepLanguageProps) {
  const t = useTranslations('setup.language');
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (locale: string) => {
    onChange(locale);

    // Get current path without locale prefix
    const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, '');

    // Navigate to the same page with the new locale
    router.replace(`/${locale}${pathWithoutLocale || '/setup'}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('title')}</h2>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
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
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <span className="text-2xl">{localeFlags[locale as Locale]}</span>
              <span className={cn('font-medium text-sm', isSelected && 'text-primary')}>
                {localeNames[locale as Locale]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
