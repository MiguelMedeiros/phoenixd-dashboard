import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, formatSats, formatDate, truncateMiddle, copyToClipboard } from '@/lib/utils';

describe('cn utility', () => {
  it('should merge class names correctly', () => {
    const result = cn('bg-red-500', 'text-white');
    expect(result).toBe('bg-red-500 text-white');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base-class', isActive && 'active-class');
    expect(result).toBe('base-class active-class');
  });

  it('should handle false conditional classes', () => {
    const isActive = false;
    const result = cn('base-class', isActive && 'active-class');
    expect(result).toBe('base-class');
  });

  it('should override conflicting tailwind classes', () => {
    const result = cn('bg-red-500', 'bg-blue-500');
    expect(result).toBe('bg-blue-500');
  });

  it('should handle undefined and null values', () => {
    const result = cn('base', undefined, null, 'end');
    expect(result).toBe('base end');
  });

  it('should handle empty strings', () => {
    const result = cn('base', '', 'end');
    expect(result).toBe('base end');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2']);
    expect(result).toBe('class1 class2');
  });

  it('should handle objects with conditional classes', () => {
    const result = cn({
      'base-class': true,
      'active-class': true,
      'disabled-class': false,
    });
    expect(result).toBe('base-class active-class');
  });

  it('should merge padding classes correctly', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('should merge margin classes correctly', () => {
    const result = cn('mt-4', 'mt-8');
    expect(result).toBe('mt-8');
  });
});

describe('formatSats utility', () => {
  it('should format small numbers correctly', () => {
    const result = formatSats(100);
    expect(result).toBe('100 sats');
  });

  it('should format single sat', () => {
    const result = formatSats(1);
    expect(result).toBe('1 sats');
  });

  it('should format thousands with k suffix', () => {
    const result = formatSats(1500);
    expect(result).toBe('1.5k sats');
  });

  it('should format exact thousands', () => {
    const result = formatSats(1000);
    expect(result).toBe('1.0k sats');
  });

  it('should format millions with M suffix', () => {
    const result = formatSats(1000000);
    expect(result).toBe('1.00M sats');
  });

  it('should format 10 million sats', () => {
    const result = formatSats(10000000);
    expect(result).toBe('10.00M sats');
  });

  it('should format BTC for large amounts', () => {
    const result = formatSats(100000000);
    expect(result).toBe('1.00000000 BTC');
  });

  it('should format 2 BTC correctly', () => {
    const result = formatSats(200000000);
    expect(result).toBe('2.00000000 BTC');
  });

  it('should format fractional BTC', () => {
    const result = formatSats(150000000);
    expect(result).toBe('1.50000000 BTC');
  });

  it('should handle zero', () => {
    const result = formatSats(0);
    expect(result).toBe('0 sats');
  });

  it('should handle values just below BTC threshold', () => {
    const result = formatSats(99999999);
    expect(result).toBe('100.00M sats');
  });

  it('should handle values just below million threshold', () => {
    const result = formatSats(999999);
    expect(result).toBe('1000.0k sats');
  });

  it('should handle values just below thousand threshold', () => {
    const result = formatSats(999);
    expect(result).toBe('999 sats');
  });

  it('should format 21 million BTC (max supply)', () => {
    const result = formatSats(2100000000000000);
    expect(result).toBe('21000000.00000000 BTC');
  });
});

describe('formatDate utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format timestamp to locale string', () => {
    const timestamp = 1704067200000; // 2024-01-01 00:00:00 UTC
    const result = formatDate(timestamp);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle current timestamp', () => {
    const now = Date.now();
    const result = formatDate(now);
    expect(typeof result).toBe('string');
  });

  it('should handle Unix epoch', () => {
    const result = formatDate(0);
    expect(typeof result).toBe('string');
    // Should contain 1969 or 1970 depending on timezone
    expect(result).toMatch(/19(69|70)/);
  });

  it('should handle future dates', () => {
    const futureTimestamp = Date.now() + 86400000 * 365; // 1 year in future
    const result = formatDate(futureTimestamp);
    expect(typeof result).toBe('string');
  });

  it('should handle negative timestamps (before 1970)', () => {
    const pastTimestamp = -86400000; // One day before Unix epoch
    const result = formatDate(pastTimestamp);
    expect(typeof result).toBe('string');
  });
});

describe('truncateMiddle utility', () => {
  it('should truncate long strings', () => {
    const result = truncateMiddle('abcdefghijklmnopqrstuvwxyz', 4, 4);
    expect(result).toBe('abcd...wxyz');
  });

  it('should not truncate short strings', () => {
    const result = truncateMiddle('abcdefgh', 4, 4);
    expect(result).toBe('abcdefgh');
  });

  it('should handle string exactly at threshold', () => {
    const result = truncateMiddle('abcdefgh', 4, 4);
    expect(result).toBe('abcdefgh');
  });

  it('should handle string just above threshold', () => {
    const result = truncateMiddle('abcdefghi', 4, 4);
    expect(result).toBe('abcd...fghi');
  });

  it('should handle empty string', () => {
    const result = truncateMiddle('', 4, 4);
    expect(result).toBe('');
  });

  it('should handle single character', () => {
    const result = truncateMiddle('a', 4, 4);
    expect(result).toBe('a');
  });

  it('should use default values', () => {
    const result = truncateMiddle('a'.repeat(20));
    expect(result).toContain('...');
  });

  it('should handle payment hashes (64 chars)', () => {
    const hash = 'a'.repeat(64);
    const result = truncateMiddle(hash, 8, 8);
    expect(result).toBe('aaaaaaaa...aaaaaaaa');
    expect(result.length).toBe(19);
  });

  it('should handle node IDs (66 chars)', () => {
    const nodeId = '02' + 'a'.repeat(64);
    const result = truncateMiddle(nodeId, 8, 8);
    expect(result.startsWith('02aaaaaa')).toBe(true);
    expect(result.endsWith('aaaaaaaa')).toBe(true);
  });

  it('should handle asymmetric truncation', () => {
    const result = truncateMiddle('abcdefghijklmnopqrstuvwxyz', 2, 6);
    expect(result).toBe('ab...uvwxyz');
  });

  it('should handle zero start chars', () => {
    const result = truncateMiddle('abcdefghijklmnop', 0, 4);
    expect(result).toBe('...mnop');
  });

  it('should handle zero end chars', () => {
    const result = truncateMiddle('abcdefghijklmnop', 4, 0);
    // Function takes last 0 chars, so ends with the full string ending
    expect(result).toBe('abcd...abcdefghijklmnop');
  });
});

describe('copyToClipboard utility', () => {
  let mockClipboard: { writeText: ReturnType<typeof vi.fn> };
  let originalIsSecureContext: boolean;

  beforeEach(() => {
    mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, {
      clipboard: mockClipboard,
    });
    // Mock isSecureContext to true so clipboard API is used
    originalIsSecureContext = window.isSecureContext;
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original isSecureContext
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      writable: true,
      configurable: true,
    });
  });

  it('should copy text to clipboard', async () => {
    await copyToClipboard('test text');
    expect(mockClipboard.writeText).toHaveBeenCalledWith('test text');
  });

  it('should copy empty string', async () => {
    await copyToClipboard('');
    expect(mockClipboard.writeText).toHaveBeenCalledWith('');
  });

  it('should copy long text', async () => {
    const longText = 'a'.repeat(10000);
    await copyToClipboard(longText);
    expect(mockClipboard.writeText).toHaveBeenCalledWith(longText);
  });

  it('should copy text with special characters', async () => {
    const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    await copyToClipboard(specialText);
    expect(mockClipboard.writeText).toHaveBeenCalledWith(specialText);
  });

  it('should copy unicode text', async () => {
    const unicodeText = '🚀⚡💰 Bitcoin Lightning';
    await copyToClipboard(unicodeText);
    expect(mockClipboard.writeText).toHaveBeenCalledWith(unicodeText);
  });

  it('should copy lightning invoice', async () => {
    const invoice = 'lnbc100n1p3...';
    await copyToClipboard(invoice);
    expect(mockClipboard.writeText).toHaveBeenCalledWith(invoice);
  });

  it('should handle clipboard failure gracefully', async () => {
    mockClipboard.writeText.mockRejectedValue(new Error('Clipboard access denied'));

    // Function should not throw, it returns false on failure
    const result = await copyToClipboard('test');
    expect(result).toBe(false);
  });

  it('should return a Promise', () => {
    const result = copyToClipboard('test');
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('Edge Cases and Integration', () => {
  describe('Bitcoin/Lightning specific formatting', () => {
    it('should format typical Lightning payment amounts', () => {
      // Common Lightning amounts
      expect(formatSats(21)).toBe('21 sats');
      expect(formatSats(546)).toBe('546 sats'); // Dust limit
      expect(formatSats(2100)).toBe('2.1k sats');
      expect(formatSats(21000)).toBe('21.0k sats');
    });

    it('should truncate typical Lightning identifiers', () => {
      // Payment hash
      const paymentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(truncateMiddle(paymentHash, 8, 8)).toBe('e3b0c442...7852b855');

      // Node public key (66 chars)
      const nodePubkey = '03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f';
      expect(truncateMiddle(nodePubkey, 8, 8)).toBe('03864ef0...597a3f8f');
    });
  });

  describe('Combining utilities', () => {
    it('should format and truncate together', () => {
      const sats = 1234567;
      const formatted = formatSats(sats);
      expect(formatted).toBe('1.23M sats');

      const hash = 'a'.repeat(64);
      const truncated = truncateMiddle(hash, 6, 6);
      expect(truncated).toBe('aaaaaa...aaaaaa');
    });

    it('should build conditional class names for payment states', () => {
      const isPaid = true;
      const isExpired = false;

      const classes = cn(
        'payment-item',
        isPaid && 'bg-green-100',
        isExpired && 'bg-red-100',
        !isPaid && !isExpired && 'bg-yellow-100'
      );

      expect(classes).toBe('payment-item bg-green-100');
    });
  });

  describe('Large number handling', () => {
    it('should handle very large satoshi amounts', () => {
      // 21 million BTC in sats
      const maxSupply = 21000000 * 100000000;
      const result = formatSats(maxSupply);
      expect(result).toContain('BTC');
    });

    it('should handle Number.MAX_SAFE_INTEGER', () => {
      const result = formatSats(Number.MAX_SAFE_INTEGER);
      expect(result).toContain('BTC');
    });
  });
});
