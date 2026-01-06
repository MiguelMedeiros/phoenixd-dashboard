'use client';

import { createContext, useContext, ReactNode } from 'react';
import {
  useCurrency,
  type UseCurrencyReturn,
  type FiatCurrencyCode,
  type CurrencyInfo,
  type BitcoinDisplayMode,
  FIAT_CURRENCIES,
  BITCOIN_DISPLAY_MODES,
} from '@/hooks/use-currency';

type CurrencyContextType = UseCurrencyReturn;

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function useCurrencyContext(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrencyContext must be used within CurrencyProvider');
  }
  return context;
}

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const currencyState = useCurrency();

  return <CurrencyContext.Provider value={currencyState}>{children}</CurrencyContext.Provider>;
}

// Re-export types and constants for convenience
export { FIAT_CURRENCIES, BITCOIN_DISPLAY_MODES };
export type { FiatCurrencyCode, CurrencyInfo, BitcoinDisplayMode };
