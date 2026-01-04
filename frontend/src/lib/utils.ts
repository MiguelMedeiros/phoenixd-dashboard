import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSats(sats: number): string {
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

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function truncateMiddle(str: string, startChars = 8, endChars = 8): string {
  if (str.length <= startChars + endChars) {
    return str;
  }
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API first (requires HTTPS on mobile)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method
    }
  }

  // Fallback for HTTP contexts (works on mobile)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    console.log('Clipboard fallback failed');
    return false;
  }
}

export function getMempoolUrl(chain: string, txId?: string): string {
  const isTestnet = chain !== 'mainnet';
  const baseUrl = isTestnet ? 'https://mempool.space/testnet' : 'https://mempool.space';

  if (txId) {
    return `${baseUrl}/tx/${txId}`;
  }

  return baseUrl;
}
