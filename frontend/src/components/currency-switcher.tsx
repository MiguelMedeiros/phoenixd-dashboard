'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCurrencyContext,
  FIAT_CURRENCIES,
  type FiatCurrencyCode,
} from '@/components/currency-provider';

interface CurrencySwitcherProps {
  openUp?: boolean;
}

export function CurrencySwitcher({ openUp = false }: CurrencySwitcherProps) {
  const { currency, setCurrency, loading } = useCurrencyContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentCurrency = FIAT_CURRENCIES.find((c) => c.code === currency) || FIAT_CURRENCIES[0];

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

  const handleCurrencyChange = (newCurrency: FiatCurrencyCode) => {
    setCurrency(newCurrency);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-all',
          'bg-white/5 hover:bg-white/10 border border-white/10',
          isOpen && 'bg-white/10 ring-2 ring-primary/50'
        )}
        title="Change display currency"
      >
        <span className="text-base font-bold text-primary">{currentCurrency.symbol}</span>
        <span className="text-sm font-medium hidden xl:inline">{currentCurrency.code}</span>
        {loading ? (
          <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
        ) : (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute py-2 w-44 rounded-xl bg-background/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95',
            openUp
              ? 'bottom-full mb-2 left-0 slide-in-from-bottom-2'
              : 'right-0 mt-2 slide-in-from-top-2'
          )}
        >
          <div className="px-3 pb-2 mb-1 border-b border-white/5">
            <p className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              Display Currency
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {FIAT_CURRENCIES.map((curr) => (
              <button
                key={curr.code}
                onClick={() => handleCurrencyChange(curr.code)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors whitespace-nowrap',
                  'hover:bg-white/5',
                  currency === curr.code && 'bg-primary/10'
                )}
              >
                <span className="text-sm font-bold w-8 text-primary shrink-0 text-right">
                  {curr.symbol}
                </span>
                <span className="text-sm font-medium flex-1">{curr.code}</span>
                {currency === curr.code && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
