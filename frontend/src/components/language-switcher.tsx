'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  openUp?: boolean;
}

export function LanguageSwitcher({ openUp = false }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
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

  const handleLocaleChange = (newLocale: Locale) => {
    // Use next-intl router which handles locale prefix correctly
    router.replace(pathname, { locale: newLocale });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl transition-all',
          'bg-white/5 hover:bg-white/10 border border-white/10',
          isOpen && 'bg-white/10 ring-2 ring-primary/50'
        )}
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-lg">{localeFlags[locale]}</span>
        <span className="text-sm font-medium hidden sm:inline">{localeNames[locale]}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute py-2 w-56 rounded-xl bg-background/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95',
            openUp
              ? 'bottom-full mb-2 left-0 slide-in-from-bottom-2'
              : 'right-0 mt-2 slide-in-from-top-2'
          )}
        >
          <div className="px-3 pb-2 mb-1 border-b border-white/5">
            <p className="text-xs text-muted-foreground font-medium">Select Language</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  'hover:bg-white/5',
                  locale === loc && 'bg-primary/10'
                )}
              >
                <span className="text-xl">{localeFlags[loc]}</span>
                <span className="flex-1 text-sm font-medium">{localeNames[loc]}</span>
                {locale === loc && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
