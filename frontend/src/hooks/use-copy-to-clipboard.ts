'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

interface UseCopyToClipboardOptions {
  successMessage?: string;
  successDescription?: string;
  resetDelay?: number;
}

interface UseCopyToClipboardReturn {
  copied: boolean;
  copiedField: string | null;
  copy: (text: string, field?: string) => Promise<boolean>;
}

async function copyToClipboardFallback(text: string): Promise<boolean> {
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
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  } catch {
    return false;
  }
}

export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {}
): UseCopyToClipboardReturn {
  const { resetDelay = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();
  const t = useTranslations('common');

  const copy = useCallback(
    async (text: string, field?: string): Promise<boolean> => {
      const success = await copyToClipboardFallback(text);

      // Always show feedback for better UX
      setCopied(true);
      if (field) {
        setCopiedField(field);
      }

      setTimeout(() => {
        setCopied(false);
        setCopiedField(null);
      }, resetDelay);

      toast({
        title: options.successMessage || t('copied'),
        description: options.successDescription || t('copiedToClipboard'),
      });

      return success;
    },
    [toast, t, options.successMessage, options.successDescription, resetDelay]
  );

  return { copied, copiedField, copy };
}
