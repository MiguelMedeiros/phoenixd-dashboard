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

// Bitcoin display modes (BIP-177 support)
export type BitcoinDisplayMode = 'sats' | 'bip177';

export const BITCOIN_DISPLAY_MODES = [
  {
    mode: 'sats' as const,
    name: 'Classic (sats)',
    description: 'Display as satoshis (e.g., 100,000 sats)',
  },
  {
    mode: 'bip177' as const,
    name: 'Modern (BIP-177)',
    description: 'Display with ₿ symbol (e.g., ₿100,000)',
  },
] as const;

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
const BITCOIN_DISPLAY_MODE_KEY = 'phoenixd-bitcoin-display-mode';
const PRICE_CACHE_KEY = 'phoenixd-btc-prices';
const CACHE_DURATION = 60 * 1000; // 60 seconds

// CoinGecko API endpoint for BTC prices
const COINGECKO_API =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur,brl,cad,gbp,jpy,aud,chf,mxn';

export interface ValueParts {
  unit: string;
  value: string;
  full: string;
}

export interface UseCurrencyReturn {
  currency: FiatCurrencyCode;
  currencyInfo: CurrencyInfo;
  setCurrency: (currency: FiatCurrencyCode) => void;
  bitcoinDisplayMode: BitcoinDisplayMode;
  setBitcoinDisplayMode: (mode: BitcoinDisplayMode) => void;
  btcPrices: Record<string, number> | null;
  loading: boolean;
  error: string | null;
  formatValue: (sats: number) => string;
  formatValueParts: (sats: number) => ValueParts;
  refreshPrices: () => Promise<void>;
}

interface SatsParts {
  unit: string;
  value: string;
}

function formatSatsClassicParts(sats: number): SatsParts {
  if (sats >= 100000000) {
    return { value: (sats / 100000000).toFixed(8), unit: 'BTC' };
  }
  if (sats >= 1000000) {
    return { value: `${(sats / 1000000).toFixed(2)}M`, unit: 'sats' };
  }
  if (sats >= 1000) {
    return { value: `${(sats / 1000).toFixed(1)}k`, unit: 'sats' };
  }
  return { value: String(sats), unit: 'sats' };
}

function formatSatsClassic(sats: number): string {
  const parts = formatSatsClassicParts(sats);
  return `${parts.value} ${parts.unit}`;
}

// BIP-177 format: Use ₿ symbol with the full satoshi value
// Example: 34,500,000 sats becomes ₿ 34,500,000
function formatSatsBip177Parts(sats: number): SatsParts {
  const formattedNumber = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(sats);
  return { value: formattedNumber, unit: '₿' };
}

function formatSatsBip177(sats: number): string {
  const parts = formatSatsBip177Parts(sats);
  // Add a thin space between symbol and number for better readability
  return `${parts.unit}\u2009${parts.value}`;
}

function formatSatsInternalParts(sats: number, mode: BitcoinDisplayMode): SatsParts {
  if (mode === 'bip177') {
    return formatSatsBip177Parts(sats);
  }
  return formatSatsClassicParts(sats);
}

function formatSatsInternal(sats: number, mode: BitcoinDisplayMode): string {
  if (mode === 'bip177') {
    return formatSatsBip177(sats);
  }
  return formatSatsClassic(sats);
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
  const [bitcoinDisplayMode, setBitcoinDisplayModeState] = useState<BitcoinDisplayMode>('sats');
  const [btcPrices, setBtcPrices] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fetchingRef = useRef(false);

  // Get currency info
  const currencyInfo = FIAT_CURRENCIES.find((c) => c.code === currency) || FIAT_CURRENCIES[0];

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

    // Load saved bitcoin display mode
    try {
      const savedMode = localStorage.getItem(BITCOIN_DISPLAY_MODE_KEY);
      if (savedMode && (savedMode === 'sats' || savedMode === 'bip177')) {
        setBitcoinDisplayModeState(savedMode as BitcoinDisplayMode);
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

  const setBitcoinDisplayMode = useCallback((mode: BitcoinDisplayMode) => {
    setBitcoinDisplayModeState(mode);
    try {
      localStorage.setItem(BITCOIN_DISPLAY_MODE_KEY, mode);
    } catch {
      // localStorage not available
    }
  }, []);

  const formatValue = useCallback(
    (sats: number): string => {
      // Always use sats format for BTC or when prices aren't loaded
      if (currency === 'BTC' || !btcPrices) {
        return formatSatsInternal(sats, bitcoinDisplayMode);
      }

      const price = btcPrices[currency];
      if (!price) {
        return formatSatsInternal(sats, bitcoinDisplayMode);
      }

      return formatFiatValue(sats, price, currency, currencyInfo.locale);
    },
    [currency, btcPrices, currencyInfo.locale, bitcoinDisplayMode]
  );

  const formatValueParts = useCallback(
    (sats: number): ValueParts => {
      // Always use sats format for BTC or when prices aren't loaded
      if (currency === 'BTC' || !btcPrices) {
        const parts = formatSatsInternalParts(sats, bitcoinDisplayMode);
        const full = formatSatsInternal(sats, bitcoinDisplayMode);
        return { unit: parts.unit, value: parts.value, full };
      }

      const price = btcPrices[currency];
      if (!price) {
        const parts = formatSatsInternalParts(sats, bitcoinDisplayMode);
        const full = formatSatsInternal(sats, bitcoinDisplayMode);
        return { unit: parts.unit, value: parts.value, full };
      }

      // For fiat, extract the currency symbol
      const full = formatFiatValue(sats, price, currency, currencyInfo.locale);
      return { unit: currencyInfo.symbol, value: full, full };
    },
    [currency, btcPrices, currencyInfo.locale, currencyInfo.symbol, bitcoinDisplayMode]
  );

  return {
    currency,
    currencyInfo,
    setCurrency,
    bitcoinDisplayMode,
    setBitcoinDisplayMode,
    btcPrices,
    loading,
    error,
    formatValue,
    formatValueParts,
    refreshPrices: fetchPrices,
  };
}
