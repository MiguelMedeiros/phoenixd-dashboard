'use client';

import { useState } from 'react';
import { Blocks, Zap, Activity, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMempoolData } from '@/hooks/use-mempool-data';
import {
  getCongestionLevel,
  formatMempoolSize,
  formatBlockHeight,
  formatFeeRate,
} from '@/lib/mempool';
import { useTranslations } from 'next-intl';
import { HeaderDropdown } from '@/components/ui/header-dropdown';

interface BitcoinNetworkButtonProps {
  chain?: string;
  className?: string;
}

export function BitcoinNetworkButton({ chain = 'mainnet', className }: BitcoinNetworkButtonProps) {
  const t = useTranslations('network');
  const [isOpen, setIsOpen] = useState(false);
  const { data, loading, error, refresh } = useMempoolData(chain);

  const fees = data?.fees;
  const mempool = data?.mempool;
  const blockHeight = data?.blockHeight;

  const congestionLevel = fees ? getCongestionLevel(fees) : 'low';

  const getCongestionColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'text-success';
      case 'medium':
        return 'text-warning';
      case 'high':
        return 'text-destructive';
    }
  };

  const mempoolUrl =
    chain === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/testnet';

  return (
    <div className={cn('relative', className)}>
      {/* Compact button showing block height + fee */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 h-11 rounded-full glass-card hover:bg-white/[0.08] transition-colors group text-xs relative"
        title={t('title')}
      >
        {loading && !data ? (
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        ) : error && !data ? (
          <span className="text-muted-foreground">--</span>
        ) : (
          <>
            {/* Block Height */}
            <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
              <Blocks className="h-3.5 w-3.5 text-bitcoin" />
              <span className="font-mono">
                {blockHeight ? formatBlockHeight(blockHeight) : '--'}
              </span>
            </div>

            {/* Separator */}
            <div className="w-px h-3 bg-white/10" />

            {/* Fast Fee */}
            <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono">{fees ? formatFeeRate(fees.fastestFee) : '--'}</span>
              <span className="text-muted-foreground text-[10px]">sat/vB</span>
            </div>
          </>
        )}
      </button>

      <HeaderDropdown
        open={isOpen}
        onOpenChange={setIsOpen}
        title={t('title')}
        width="md"
        headerActions={
          <button
            onClick={(e) => {
              e.stopPropagation();
              refresh();
            }}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={t('retry')}
          >
            <RefreshCw className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')} />
          </button>
        }
        footer={
          <a
            href={mempoolUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            mempool.space <ExternalLink className="h-3 w-3" />
          </a>
        }
      >
        <div className="p-4 space-y-4">
          {error && !data ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">{t('unavailable')}</p>
              <button onClick={refresh} className="text-sm text-primary hover:underline">
                {t('retry')}
              </button>
            </div>
          ) : (
            <>
              {/* Fee Rates */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Fee Rates
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">{t('fast')}</span>
                    </div>
                    <p className="font-mono font-semibold">
                      {fees ? formatFeeRate(fees.fastestFee) : '--'}
                      <span className="text-xs text-muted-foreground ml-1">sat/vB</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-muted-foreground">{t('halfHour')}</span>
                    </div>
                    <p className="font-mono font-semibold">
                      {fees ? formatFeeRate(fees.halfHourFee) : '--'}
                      <span className="text-xs text-muted-foreground ml-1">sat/vB</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-muted-foreground">{t('hour')}</span>
                    </div>
                    <p className="font-mono font-semibold">
                      {fees ? formatFeeRate(fees.hourFee) : '--'}
                      <span className="text-xs text-muted-foreground ml-1">sat/vB</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-muted-foreground">{t('economy')}</span>
                    </div>
                    <p className="font-mono font-semibold">
                      {fees ? formatFeeRate(fees.economyFee) : '--'}
                      <span className="text-xs text-muted-foreground ml-1">sat/vB</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Network Stats */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Network
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                      <Blocks className="h-4 w-4 text-bitcoin" />
                      <span className="text-sm text-muted-foreground">{t('blockHeight')}</span>
                    </div>
                    <p className="font-mono font-semibold">
                      {blockHeight ? blockHeight.toLocaleString() : '--'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">{t('mempoolSize')}</span>
                    </div>
                    <p className="font-mono font-semibold">
                      {mempool ? formatMempoolSize(mempool.vsize) : '--'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
                    <span className="text-sm text-muted-foreground">{t('congestion')}</span>
                    <p className={cn('font-semibold', getCongestionColor(congestionLevel))}>
                      {t(`congestion_${congestionLevel}`)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </HeaderDropdown>
    </div>
  );
}
