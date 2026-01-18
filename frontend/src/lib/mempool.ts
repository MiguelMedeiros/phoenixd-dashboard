/**
 * Mempool.space API client
 * Provides fee estimates, mempool status, and block height information
 */

// API base URLs
const MAINNET_API = 'https://mempool.space/api';
const TESTNET_API = 'https://mempool.space/testnet/api';

// Cache configuration
const CACHE_TTL_MS = 30_000; // 30 seconds

// Types
export interface FeeEstimates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

// Precise fee estimates (with decimal precision for sub-sat fees)
// Same structure as FeeEstimates but values can have up to 3 decimal places
export type PreciseFeeEstimates = FeeEstimates;

export interface MempoolInfo {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: number[][];
}

export interface MempoolData {
  fees: PreciseFeeEstimates;
  mempool: MempoolInfo;
  blockHeight: number;
  lastUpdated: number;
}

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: {
  mainnet: CacheEntry<MempoolData> | null;
  testnet: CacheEntry<MempoolData> | null;
} = {
  mainnet: null,
  testnet: null,
};

/**
 * Get the API base URL for the given chain
 */
function getApiUrl(chain: string): string {
  return chain === 'mainnet' ? MAINNET_API : TESTNET_API;
}

/**
 * Get the mempool.space website URL for the given chain
 */
export function getMempoolWebUrl(chain: string): string {
  return chain === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/testnet';
}

/**
 * Fetch recommended fee estimates (integer sat/vB)
 */
export async function getFeeEstimates(chain: string = 'mainnet'): Promise<FeeEstimates> {
  const apiUrl = getApiUrl(chain);
  const response = await fetch(`${apiUrl}/v1/fees/recommended`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch fee estimates: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch precise fee estimates (with decimal precision for sub-sat fees)
 * Returns fees with up to 3 decimal places
 */
export async function getPreciseFeeEstimates(
  chain: string = 'mainnet',
  minFee?: number
): Promise<PreciseFeeEstimates> {
  const apiUrl = getApiUrl(chain);
  const url =
    minFee !== undefined ? `${apiUrl}/v1/fees/precise?min=${minFee}` : `${apiUrl}/v1/fees/precise`;

  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch precise fee estimates: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch mempool information
 */
export async function getMempoolInfo(chain: string = 'mainnet'): Promise<MempoolInfo> {
  const apiUrl = getApiUrl(chain);
  const response = await fetch(`${apiUrl}/mempool`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch mempool info: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch current block height
 */
export async function getBlockHeight(chain: string = 'mainnet'): Promise<number> {
  const apiUrl = getApiUrl(chain);
  const response = await fetch(`${apiUrl}/blocks/tip/height`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch block height: ${response.status}`);
  }

  const text = await response.text();
  return parseInt(text, 10);
}

/**
 * Fetch all mempool data with caching
 */
export async function getMempoolData(
  chain: string = 'mainnet',
  forceRefresh: boolean = false
): Promise<MempoolData> {
  const cacheKey = chain === 'mainnet' ? 'mainnet' : 'testnet';
  const cached = cache[cacheKey];

  // Return cached data if still valid
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch all data in parallel (using precise fees for sub-sat precision)
  const [fees, mempool, blockHeight] = await Promise.all([
    getPreciseFeeEstimates(chain),
    getMempoolInfo(chain),
    getBlockHeight(chain),
  ]);

  const data: MempoolData = {
    fees,
    mempool,
    blockHeight,
    lastUpdated: Date.now(),
  };

  // Update cache
  cache[cacheKey] = {
    data,
    timestamp: Date.now(),
  };

  return data;
}

/**
 * Get congestion level based on fee rates
 */
export function getCongestionLevel(fees: FeeEstimates): 'low' | 'medium' | 'high' {
  const { fastestFee } = fees;

  if (fastestFee <= 10) {
    return 'low';
  } else if (fastestFee <= 50) {
    return 'medium';
  } else {
    return 'high';
  }
}

/**
 * Format mempool size in vMB
 */
export function formatMempoolSize(vsize: number): string {
  const vMB = vsize / 1_000_000;
  if (vMB >= 1) {
    return `${vMB.toFixed(1)} vMB`;
  }
  return `${(vsize / 1_000).toFixed(0)} vKB`;
}

/**
 * Format block height with thousand separators
 */
export function formatBlockHeight(height: number): string {
  return height.toLocaleString();
}

/**
 * Format fee rate with appropriate decimal precision
 * Shows decimals only when needed (for sub-sat fees)
 */
export function formatFeeRate(feeRate: number): string {
  // If it's a whole number, show without decimals
  if (Number.isInteger(feeRate)) {
    return feeRate.toString();
  }
  // For sub-sat fees, show up to 3 decimal places (removing trailing zeros)
  return parseFloat(feeRate.toFixed(3)).toString();
}
