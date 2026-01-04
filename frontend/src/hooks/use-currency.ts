'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Supported fiat currencies
export const FIAT_CURRENCIES = [
  { code: 'BTC', name: 'Bitcoin (sats)', symbol: '₿', locale: 'en-US' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', locale: 'pt-BR' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', locale: 'en-CA' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', locale: 'es-MX' },
] as const;

export type FiatCurrencyCode = (typeof FIAT_CURRENCIES)[number]['code'];

export interface CurrencyInfo {
  code: FiatCurrencyCode;
  name: string;
  symbol: string;
  locale: string;
}

interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

const STORAGE_KEY = 'phoenixd-currency';
const PRICE_CACHE_KEY = 'phoenixd-btc-prices';
const CACHE_DURATION = 60 * 1000; // 60 seconds

// CoinGecko API endpoint for BTC prices
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur,brl,cad,gbp,jpy,aud,chf,mxn';

export interface UseCurrencyReturn {
  currency: FiatCurrencyCode;
  currencyInfo: CurrencyInfo;
  setCurrency: (currency: FiatCurrencyCode) => void;
  btcPrices: Record<string, number> | null;
  loading: boolean;
  error: string | null;
  formatValue: (sats: number) => string;
  refreshPrices: () => Promise<void>;
}

function formatSatsInternal(sats: number): string {
  if (sats >= 100000000) {
    return `${(sats / 100000000).toFixed(8)} BTC`;
  }
  if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(2)}M sats`;
  }
  if (sats >= 1000) {
    return `${(sats / 1000).toFixed(1)}k sats`;
  }
  return `${sats} sats`;
}

function formatFiatValue(
  sats: number,
  btcPrice: number,
  currency: FiatCurrencyCode,
  locale: string
): string {
  const btcAmount = sats / 100_000_000;
  const fiatValue = btcAmount * btcPrice;

  // Handle very small values
  if (fiatValue < 0.01 && fiatValue > 0) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(fiatValue);
  }

  // Handle JPY which doesn't use decimals
  if (currency === 'JPY') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(fiatValue);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fiatValue);
}

export function useCurrency(): UseCurrencyReturn {
  const [currency, setCurrencyState] = useState<FiatCurrencyCode>('BTC');
  const [btcPrices, setBtcPrices] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fetchingRef = useRef(false);

  // Get currency info
  const currencyInfo =
    FIAT_CURRENCIES.find((c) => c.code === currency) || FIAT_CURRENCIES[0];

  // Load saved currency preference on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && FIAT_CURRENCIES.some((c) => c.code === saved)) {
        setCurrencyState(saved as FiatCurrencyCode);
      }
    } catch {
      // localStorage not available
    }

    // Load cached prices
    try {
      const cachedStr = localStorage.getItem(PRICE_CACHE_KEY);
      if (cachedStr) {
        const cached: PriceCache = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
          setBtcPrices(cached.prices);
        }
      }
    } catch {
      // Cache not available
    }
  }, []);

  // Fetch BTC prices from CoinGecko
  const fetchPrices = useCallback(async () => {
    if (fetchingRef.current) return;

    // Check cache first
    try {
      const cachedStr = localStorage.getItem(PRICE_CACHE_KEY);
      if (cachedStr) {
        const cached: PriceCache = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
          setBtcPrices(cached.prices);
          return;
        }
      }
    } catch {
      // Continue to fetch
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(COINGECKO_API);
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      const data = await response.json();

      // CoinGecko returns { bitcoin: { usd: 123, eur: 456, ... } }
      const prices = data.bitcoin as Record<string, number>;

      // Convert keys to uppercase to match our currency codes
      const normalizedPrices: Record<string, number> = {};
      Object.entries(prices).forEach(([key, value]) => {
        normalizedPrices[key.toUpperCase()] = value;
      });

      setBtcPrices(normalizedPrices);

      // Cache the prices
      try {
        const cache: PriceCache = {
          prices: normalizedPrices,
          timestamp: Date.now(),
        };
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
      } catch {
        // Cache write failed
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      // Keep using cached prices if available
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Fetch prices on mount and when currency changes (if not BTC)
  useEffect(() => {
    if (mounted && currency !== 'BTC') {
      fetchPrices();
    }
  }, [mounted, currency, fetchPrices]);

  // Refresh prices periodically when using fiat
  useEffect(() => {
    if (!mounted || currency === 'BTC') return;

    const interval = setInterval(fetchPrices, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [mounted, currency, fetchPrices]);

  const setCurrency = useCallback((newCurrency: FiatCurrencyCode) => {
    setCurrencyState(newCurrency);
    try {
      localStorage.setItem(STORAGE_KEY, newCurrency);
    } catch {
      // localStorage not available
    }
  }, []);

  const formatValue = useCallback(
    (sats: number): string => {
      // Always use sats format for BTC or when prices aren't loaded
      if (currency === 'BTC' || !btcPrices) {
        return formatSatsInternal(sats);
      }

      const price = btcPrices[currency];
      if (!price) {
        return formatSatsInternal(sats);
      }

      return formatFiatValue(sats, price, currency, currencyInfo.locale);
    },
    [currency, btcPrices, currencyInfo.locale]
  );

  return {
    currency,
    currencyInfo,
    setCurrency,
    btcPrices,
    loading,
    error,
    formatValue,
    refreshPrices: fetchPrices,
  };
}
