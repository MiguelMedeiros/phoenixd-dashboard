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

export type ParsedPaymentRequest =
  | { type: 'invoice'; invoice: string }
  | { type: 'offer'; offer: string }
  | { type: 'address'; address: string }
  | { type: 'btcaddress'; btcaddress: string }
  | { type: 'lnurl'; lnurl: string }
  | { type: 'unknown' };

export function parsePaymentRequest(data: string): ParsedPaymentRequest {
  const lowerData = data.toLowerCase().trim();

  // Lightning invoice (lnbc, lntb, lnbcrt)
  if (
    lowerData.startsWith('lnbc') ||
    lowerData.startsWith('lntb') ||
    lowerData.startsWith('lnbcrt') ||
    lowerData.startsWith('lightning:')
  ) {
    const invoiceData = data.replace(/^lightning:/i, '');
    return { type: 'invoice', invoice: invoiceData };
  }

  // BOLT12 Offer (lno)
  if (lowerData.startsWith('lno')) {
    return { type: 'offer', offer: data };
  }

  // Lightning Address (contains @)
  if (data.includes('@') && !data.includes('://')) {
    return { type: 'address', address: data };
  }

  // Bitcoin address (bc1, 1, 3, tb1)
  if (
    lowerData.startsWith('bc1') ||
    lowerData.startsWith('tb1') ||
    lowerData.startsWith('1') ||
    lowerData.startsWith('3') ||
    lowerData.startsWith('bitcoin:')
  ) {
    const address = data.replace(/^bitcoin:/i, '').split('?')[0];
    return { type: 'btcaddress', btcaddress: address };
  }

  // LNURL
  if (lowerData.startsWith('lnurl')) {
    return { type: 'lnurl', lnurl: data };
  }

  return { type: 'unknown' };
}
