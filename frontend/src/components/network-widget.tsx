'use client';

import { Zap, Blocks, Activity, ExternalLink, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useMempoolData } from '@/hooks/use-mempool-data';
import {
  getCongestionLevel,
  formatMempoolSize,
  formatBlockHeight,
  getMempoolWebUrl,
} from '@/lib/mempool';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface NetworkWidgetProps {
  chain?: string;
  className?: string;
  variant?: 'full' | 'compact';
}

export function NetworkWidget({
  chain = 'mainnet',
  className,
  variant = 'full',
}: NetworkWidgetProps) {
  const t = useTranslations('network');
  const { fees, mempool, blockHeight, loading, error, refresh, lastUpdated } =
    useMempoolData(chain);

  const congestion = fees ? getCongestionLevel(fees) : null;

  const getCongestionColor = (level: 'low' | 'medium' | 'high' | null) => {
    switch (level) {
      case 'low':
        return 'text-success';
      case 'medium':
        return 'text-yellow-500';
      case 'high':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getCongestionBg = (level: 'low' | 'medium' | 'high' | null) => {
    switch (level) {
      case 'low':
        return 'bg-success/10';
      case 'medium':
        return 'bg-yellow-500/10';
      case 'high':
        return 'bg-red-500/10';
      default:
        return 'bg-white/5';
    }
  };

  const formatLastUpdated = (timestamp: number | null) => {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t('justNow');
    const minutes = Math.floor(seconds / 60);
    return t('minutesAgo', { count: minutes });
  };

  if (loading && !fees) {
    return (
      <div className={cn('glass-card rounded-2xl p-4', className)}>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error && !fees) {
    return (
      <div className={cn('glass-card rounded-2xl p-4', className)}>
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
          <button
            onClick={refresh}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('glass-card rounded-2xl p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-bitcoin/10 flex items-center justify-center">
              <Blocks className="h-4 w-4 text-bitcoin" />
            </div>
            <h3 className="font-semibold text-sm">{t('title')}</h3>
          </div>
          <a
            href={getMempoolWebUrl(chain)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            mempool.space <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Fast Fee */}
          <div className="rounded-xl bg-red-500/10 p-3 text-center">
            <span className="text-[10px] text-muted-foreground block">{t('fast')}</span>
            <span className="text-sm font-bold text-red-500">{fees?.fastestFee ?? '-'}</span>
            <span className="text-[10px] text-muted-foreground ml-0.5">sat/vB</span>
          </div>

          {/* Hour Fee */}
          <div className="rounded-xl bg-yellow-500/10 p-3 text-center">
            <span className="text-[10px] text-muted-foreground block">{t('hour')}</span>
            <span className="text-sm font-bold text-yellow-500">{fees?.hourFee ?? '-'}</span>
            <span className="text-[10px] text-muted-foreground ml-0.5">sat/vB</span>
          </div>

          {/* Economy Fee */}
          <div className="rounded-xl bg-success/10 p-3 text-center">
            <span className="text-[10px] text-muted-foreground block">{t('economy')}</span>
            <span className="text-sm font-bold text-success">{fees?.economyFee ?? '-'}</span>
            <span className="text-[10px] text-muted-foreground ml-0.5">sat/vB</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-card rounded-2xl p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-bitcoin/10 flex items-center justify-center">
            <Blocks className="h-4 w-4 text-bitcoin" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t('title')}</h3>
            <p className="text-[10px] text-muted-foreground">{formatLastUpdated(lastUpdated)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <a
            href={getMempoolWebUrl(chain)}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Fee Rates */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {/* Fast */}
        <div className="rounded-xl bg-red-500/10 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3 w-3 text-red-500" />
            <span className="text-[10px] text-muted-foreground">{t('fast')}</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold text-red-500">{fees?.fastestFee ?? '-'}</span>
            <span className="text-[10px] text-muted-foreground">sat/vB</span>
          </div>
        </div>

        {/* 30 min */}
        <div className="rounded-xl bg-orange-500/10 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3 w-3 text-orange-500" />
            <span className="text-[10px] text-muted-foreground">{t('halfHour')}</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold text-orange-500">{fees?.halfHourFee ?? '-'}</span>
            <span className="text-[10px] text-muted-foreground">sat/vB</span>
          </div>
        </div>

        {/* Hour */}
        <div className="rounded-xl bg-yellow-500/10 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3 w-3 text-yellow-500" />
            <span className="text-[10px] text-muted-foreground">{t('hour')}</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold text-yellow-500">{fees?.hourFee ?? '-'}</span>
            <span className="text-[10px] text-muted-foreground">sat/vB</span>
          </div>
        </div>

        {/* Economy */}
        <div className="rounded-xl bg-success/10 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3 w-3 text-success" />
            <span className="text-[10px] text-muted-foreground">{t('economy')}</span>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold text-success">{fees?.economyFee ?? '-'}</span>
            <span className="text-[10px] text-muted-foreground">sat/vB</span>
          </div>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-3 gap-2">
        {/* Block Height */}
        <div className="rounded-xl bg-white/5 p-3">
          <span className="text-[10px] text-muted-foreground block mb-0.5">{t('blockHeight')}</span>
          <span className="text-sm font-mono font-semibold">
            {blockHeight ? formatBlockHeight(blockHeight) : '-'}
          </span>
        </div>

        {/* Mempool Size */}
        <div className="rounded-xl bg-white/5 p-3">
          <span className="text-[10px] text-muted-foreground block mb-0.5">{t('mempoolSize')}</span>
          <span className="text-sm font-mono font-semibold">
            {mempool ? formatMempoolSize(mempool.vsize) : '-'}
          </span>
        </div>

        {/* Congestion */}
        <div className={cn('rounded-xl p-3', getCongestionBg(congestion))}>
          <span className="text-[10px] text-muted-foreground block mb-0.5">{t('congestion')}</span>
          <span className={cn('text-sm font-semibold capitalize', getCongestionColor(congestion))}>
            {congestion ? t(`congestion_${congestion}`) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
