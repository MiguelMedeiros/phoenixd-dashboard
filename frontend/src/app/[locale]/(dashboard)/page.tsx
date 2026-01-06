'use client';

import { useEffect, useState } from 'react';
import {
  Zap,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Copy,
  TrendingUp,
  ChevronRight,
  Wrench,
  Link2,
} from 'lucide-react';
import {
  getNodeInfo,
  getBalance,
  listChannels,
  getIncomingPayments,
  getOutgoingPayments,
  type Channel,
  type IncomingPayment,
  type OutgoingPayment,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCurrencyContext } from '@/components/currency-provider';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Link } from '@/i18n/navigation';
import { PaymentsChart } from '@/components/payments-chart';
import { useTranslations } from 'next-intl';

interface NodeInfo {
  nodeId: string;
  chain: string;
  version: string;
  channels: Channel[];
}

type RecentPayment = IncomingPayment | OutgoingPayment;

export default function OverviewPage() {
  const t = useTranslations('overview');
  const tc = useTranslations('common');
  const { formatValue, currency } = useCurrencyContext();
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [balance, setBalance] = useState<{ balanceSat: number; feeCreditSat: number } | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [allIncoming, setAllIncoming] = useState<IncomingPayment[]>([]);
  const [allOutgoing, setAllOutgoing] = useState<OutgoingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { copy: copyToClipboard } = useCopyToClipboard();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [info, bal, ch, incoming, outgoing] = await Promise.all([
          getNodeInfo(),
          getBalance(),
          listChannels(),
          getIncomingPayments({ limit: 100 }),
          getOutgoingPayments({ limit: 100 }),
        ]);
        setNodeInfo(info);
        setBalance(bal);
        setChannels(ch);
        setAllIncoming(incoming || []);
        setAllOutgoing(outgoing || []);

        // Combine and sort recent payments - more for mobile
        const allPayments = [...(incoming || []), ...(outgoing || [])];
        allPayments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRecentPayments(allPayments.slice(0, 10));
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast({
          variant: 'destructive',
          title: tc('error'),
          description: t('loadError'),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const totalCapacity = channels.reduce((acc, ch) => acc + (ch.capacitySat || 0), 0);
  const totalInbound = channels.reduce((acc, ch) => acc + (ch.inboundLiquiditySat || 0), 0);
  const activeChannels = channels.filter((c) => c.state?.toUpperCase() === 'NORMAL').length;

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-4">
          <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
        </div>
        {/* Desktop skeleton */}
        <div className="hidden md:block space-y-6">
          <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* ============================================
          MOBILE LAYOUT - Wallet-Focused
          ============================================ */}
      <div className="md:hidden space-y-4">
        {/* Balance Card with Actions */}
        <div className="hero-card p-5">
          <div className="text-center mb-4">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/50">
              {t('lightningBalance')}
            </span>
            <div className="flex items-baseline justify-center gap-1.5 mt-1">
              <span className="text-4xl font-bold text-white tabular-nums">
                {formatValue(balance?.balanceSat || 0)}
              </span>
              {currency === 'BTC' && <span className="text-base text-white/40">{tc('sats')}</span>}
            </div>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{t('recentPayments')}</h3>
            <Link href="/payments" className="text-xs text-primary flex items-center gap-0.5">
              {tc('viewAll')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {recentPayments.length > 0 ? (
            <div className="space-y-0.5">
              {recentPayments.slice(0, 8).map((payment) => {
                const isIncoming = 'receivedSat' in payment;
                const amount = isIncoming
                  ? (payment as IncomingPayment).receivedSat
                  : (payment as OutgoingPayment).sent || 0;
                const key = isIncoming
                  ? (payment as IncomingPayment).paymentHash
                  : (payment as OutgoingPayment).paymentId;

                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0"
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                        isIncoming ? 'bg-success/15' : 'bg-primary/15'
                      )}
                    >
                      {isIncoming ? (
                        <ArrowDownToLine className="h-5 w-5 text-success" />
                      ) : (
                        <ArrowUpFromLine className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {isIncoming ? t('received') : t('sent')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.completedAt
                          ? new Date(payment.completedAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : tc('pending')}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'font-mono text-sm font-semibold tabular-nums',
                        isIncoming ? 'text-success' : 'text-foreground'
                      )}
                    >
                      {isIncoming ? '+' : '-'}
                      {formatValue(amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t('createInvoice')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================
          DESKTOP LAYOUT - Full Dashboard
          ============================================ */}
      <div className="hidden md:block space-y-6">
        {/* Hero Section */}
        <div className="hero-card p-6">
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-white/60">
                {t('lightningBalance')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">
                  {formatValue(balance?.balanceSat || 0)}
                </span>
                {currency === 'BTC' && <span className="text-lg text-white/50">{tc('sats')}</span>}
              </div>

              <div className="flex gap-2 pt-2">
                <Link href="/receive">
                  <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-transform hover:scale-105">
                    <ArrowDownToLine className="h-4 w-4" />
                    {tc('receive')}
                  </button>
                </Link>
                <Link href="/send">
                  <button className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30">
                    <ArrowUpFromLine className="h-4 w-4" />
                    {tc('send')}
                  </button>
                </Link>
              </div>
            </div>

            <Zap className="h-24 w-24 text-white/15" strokeWidth={1} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-bold">{activeChannels}</p>
                <p className="text-xs text-muted-foreground">{t('channels')}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Layers className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{formatValue(totalCapacity)}</p>
                <p className="text-xs text-muted-foreground">{t('capacity')}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-bitcoin/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-bitcoin" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-success truncate">
                  {formatValue(totalInbound)}
                </p>
                <p className="text-xs text-muted-foreground">{t('inbound')}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                <ArrowDownToLine className="h-4 w-4 text-success" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-2xl font-bold value-highlight truncate">
                  {formatValue(balance?.feeCreditSat || 0)}
                </p>
                <p className="text-xs text-muted-foreground">{t('feeCredit')}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-lightning/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-lightning" />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Activity Chart */}
        <PaymentsChart incomingPayments={allIncoming} outgoingPayments={allOutgoing} />

        {/* Quick Actions Grid */}
        <div className="grid gap-3 grid-cols-5">
          <Link
            href="/receive"
            className="glass-card rounded-2xl p-4 hover:bg-white/[0.06] transition-colors group"
          >
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ArrowDownToLine className="h-5 w-5 text-success" />
            </div>
            <p className="font-medium text-sm">{tc('receive')}</p>
            <p className="text-xs text-muted-foreground">{t('createInvoice')}</p>
          </Link>

          <Link
            href="/send"
            className="glass-card rounded-2xl p-4 hover:bg-white/[0.06] transition-colors group"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ArrowUpFromLine className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-sm">{tc('send')}</p>
            <p className="text-xs text-muted-foreground">{t('payInvoice')}</p>
          </Link>

          <Link
            href="/channels"
            className="glass-card rounded-2xl p-4 hover:bg-white/[0.06] transition-colors group"
          >
            <div className="h-10 w-10 rounded-xl bg-bitcoin/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Layers className="h-5 w-5 text-bitcoin" />
            </div>
            <p className="font-medium text-sm">{tc('channels')}</p>
            <p className="text-xs text-muted-foreground">{t('manageLiquidity')}</p>
          </Link>

          <Link
            href="/tools"
            className="glass-card rounded-2xl p-4 hover:bg-white/[0.06] transition-colors group"
          >
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Wrench className="h-5 w-5 text-accent" />
            </div>
            <p className="font-medium text-sm">{tc('tools')}</p>
            <p className="text-xs text-muted-foreground">{t('decodeAndFees')}</p>
          </Link>

          <Link
            href="/lnurl"
            className="glass-card rounded-2xl p-4 hover:bg-white/[0.06] transition-colors group"
          >
            <div className="h-10 w-10 rounded-xl bg-lightning/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Link2 className="h-5 w-5 text-lightning" />
            </div>
            <p className="font-medium text-sm">{tc('lnurl')}</p>
            <p className="text-xs text-muted-foreground">{t('payAndAuth')}</p>
          </Link>
        </div>

        {/* Bottom Row: Node Info + Recent Payments */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Node Info */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">{t('nodeInfo')}</h3>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block">
                {t('nodeId')}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 truncate rounded-xl bg-white/5 px-3 py-2 font-mono text-xs">
                  {nodeInfo?.nodeId?.slice(0, 12)}...{nodeInfo?.nodeId?.slice(-4)}
                </div>
                <button
                  onClick={() => copyToClipboard(nodeInfo?.nodeId || '')}
                  className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <span className="text-[10px] text-muted-foreground block">{t('network')}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-bitcoin" />
                  <span className="text-sm font-medium capitalize">{nodeInfo?.chain}</span>
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <span className="text-[10px] text-muted-foreground block">{t('version')}</span>
                <span className="font-mono text-xs font-medium mt-0.5 block truncate">
                  {nodeInfo?.version}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="lg:col-span-3 glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{t('recentPayments')}</h3>
              <Link
                href="/payments"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                {tc('viewAll')} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {recentPayments.length > 0 ? (
              <div className="space-y-1.5">
                {recentPayments.slice(0, 5).map((payment) => {
                  const isIncoming = 'receivedSat' in payment;
                  const amount = isIncoming
                    ? (payment as IncomingPayment).receivedSat
                    : (payment as OutgoingPayment).sent || 0;
                  const key = isIncoming
                    ? (payment as IncomingPayment).paymentHash
                    : (payment as OutgoingPayment).paymentId;

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <div
                        className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
                          isIncoming ? 'bg-success/10' : 'bg-primary/10'
                        )}
                      >
                        {isIncoming ? (
                          <ArrowDownToLine className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {isIncoming ? t('received') : t('sent')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {payment.completedAt
                            ? new Date(payment.completedAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : tc('pending')}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'font-mono text-sm font-semibold',
                          isIncoming ? 'text-success' : 'text-foreground'
                        )}
                      >
                        {isIncoming ? '+' : '-'}
                        {formatValue(amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
