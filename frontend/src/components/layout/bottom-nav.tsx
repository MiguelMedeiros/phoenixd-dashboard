'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { ArrowDownToLine, ScanLine } from 'lucide-react';
import { cn, parsePaymentRequest } from '@/lib/utils';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { QRScanner } from '@/components/qr-scanner';

export function BottomNav() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScan = (data: string) => {
    setScannerOpen(false);
    const parsed = parsePaymentRequest(data);

    switch (parsed.type) {
      case 'invoice':
        router.push(`/send?invoice=${encodeURIComponent(parsed.invoice)}`);
        break;
      case 'offer':
        router.push(`/send?offer=${encodeURIComponent(parsed.offer)}`);
        break;
      case 'lnurl':
        router.push(`/lnurl?lnurl=${encodeURIComponent(parsed.lnurl)}`);
        break;
      case 'address':
        router.push(`/send?address=${encodeURIComponent(parsed.address)}`);
        break;
      case 'btcaddress':
        router.push(`/send?btcaddress=${encodeURIComponent(parsed.btcaddress)}`);
        break;
      default:
        // Try as invoice anyway
        router.push(`/send?invoice=${encodeURIComponent(data)}`);
    }
  };

  const isReceiveActive = pathname === '/receive';
  const isSendActive = pathname === '/send' || pathname === '/lnurl';

  return (
    <>
      {/* Bottom Navigation Bar - Wallet Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden">
        <div className="glass-card border-t border-black/5 dark:border-white/10 px-4 pb-safe">
          <div className="flex items-center justify-center gap-4 py-3">
            {/* Receive Button */}
            <Link
              href="/receive"
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-medium transition-all',
                isReceiveActive
                  ? 'bg-primary text-white'
                  : 'bg-black/5 text-foreground/80 hover:bg-black/10 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15'
              )}
            >
              <ArrowDownToLine className="h-5 w-5" />
              <span>{t('receive')}</span>
            </Link>

            {/* Divider */}
            <div className="h-8 w-px bg-black/10 dark:bg-white/20" />

            {/* Send/Scan Button */}
            <button
              onClick={() => setScannerOpen(true)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-medium transition-all',
                isSendActive
                  ? 'bg-primary text-white'
                  : 'bg-black/5 text-foreground/80 hover:bg-black/10 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15'
              )}
            >
              <ScanLine className="h-5 w-5" />
              <span>{t('send')}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* QR Scanner */}
      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </>
  );
}
