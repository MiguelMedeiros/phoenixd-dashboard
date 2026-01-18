'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Copy,
  TrendingUp,
  ChevronRight,
  ScrollText,
  Terminal,
  Server,
  BookOpen,
  Github,
  Users,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { PaymentList } from '@/components/payment-list';
import {
  getNodeInfo,
  getBalance,
  listChannels,
  getIncomingPayments,
  getOutgoingPayments,
  getContacts,
  getRecurringPayments,
  type Channel,
  type IncomingPayment,
  type OutgoingPayment,
  type Contact,
  type RecurringPayment,
} from '@/lib/api';
import { useCurrencyContext } from '@/components/currency-provider';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Link } from '@/i18n/navigation';
import { PaymentsChart } from '@/components/payments-chart';
import { StatCard, StatCardGrid } from '@/components/stat-card';
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
  const { formatValue } = useCurrencyContext();
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [balance, setBalance] = useState<{ balanceSat: number; feeCreditSat: number } | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [allIncoming, setAllIncoming] = useState<IncomingPayment[]>([]);
  const [allOutgoing, setAllOutgoing] = useState<OutgoingPayment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { copy: copyToClipboard } = useCopyToClipboard();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [info, bal, ch, incoming, outgoing, contactsList, recurring] = await Promise.all([
        getNodeInfo(),
        getBalance(),
        listChannels(),
        getIncomingPayments({ limit: 100 }),
        getOutgoingPayments({ limit: 100 }),
        getContacts(),
        getRecurringPayments({ status: 'active' }),
      ]);
      setNodeInfo(info);
      setBalance(bal);
      // Filter out invalid channels
      const validChannels = (ch || []).filter(
        (c) => c && c.channelId && c.state && typeof c.capacitySat === 'number'
      );
      setChannels(validChannels);
      setAllIncoming(incoming || []);
      setAllOutgoing(outgoing || []);
      setContacts(contactsList || []);
      setRecurringPayments(recurring || []);

      // Combine and sort recent payments by most recent activity
      // Use completedAt for paid payments, createdAt for pending
      const allPayments = [...(incoming || []), ...(outgoing || [])];
      allPayments.sort((a, b) => {
        const aTime = a.completedAt || a.createdAt || 0;
        const bTime = b.completedAt || b.createdAt || 0;
        return bTime - aTime;
      });
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
  }, [toast, tc, t]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing overview data...');
      // Small delay to let backend connect to new phoenixd
      setTimeout(fetchData, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchData]);

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

          <PaymentList
            payments={recentPayments}
            formatValue={formatValue}
            variant="compact"
            limit={8}
            showCategories={false}
            showFees={false}
            showArrow={true}
            showDetailsDialog={true}
            emptyIcon="zap"
            emptyMessage={t('noPayments')}
            emptySubMessage={t('createInvoice')}
          />
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
        <StatCardGrid columns={4}>
          <StatCard label={t('channels')} value={activeChannels} icon={Layers} variant="primary" />
          <StatCard
            label={t('capacity')}
            value={formatValue(totalCapacity)}
            icon={TrendingUp}
            variant="warning"
          />
          <StatCard
            label={t('inbound')}
            value={formatValue(totalInbound)}
            icon={ArrowDownToLine}
            variant="success"
          />
          <StatCard
            label={t('feeCredit')}
            value={formatValue(balance?.feeCreditSat || 0)}
            icon={Zap}
            variant="warning"
          />
        </StatCardGrid>

        {/* Payment Activity Chart */}
        <PaymentsChart incomingPayments={allIncoming} outgoingPayments={allOutgoing} />

        {/* Contacts & Recurring Payments Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Contacts Card */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-cyan-500" />
                </div>
                <h3 className="font-semibold text-sm">{tc('contacts')}</h3>
              </div>
              <Link
                href="/contacts"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                {tc('viewAll')} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {contacts.length === 0 ? (
              <div className="py-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
                <Link
                  href="/contacts"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  + {t('manageContacts')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.slice(0, 4).map((contact) => (
                  <Link
                    key={contact.id}
                    href="/contacts"
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/15 to-blue-500/15 shrink-0">
                      <Users className="h-4 w-4 text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {contact.addresses[0]?.address
                          ? contact.addresses[0].address.length > 25
                            ? `${contact.addresses[0].address.slice(0, 25)}...`
                            : contact.addresses[0].address
                          : '-'}
                      </p>
                    </div>
                    {contact._count?.payments && contact._count.payments > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Zap className="h-2.5 w-2.5" />
                        {contact._count.payments}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </Link>
                ))}
                {contacts.length > 4 && (
                  <Link
                    href="/contacts"
                    className="block text-center py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    +{contacts.length - 4} more contacts
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Recurring Payments Card */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-purple-500" />
                </div>
                <h3 className="font-semibold text-sm">{tc('recurring')}</h3>
              </div>
              <Link
                href="/recurring"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                {tc('viewAll')} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {recurringPayments.length === 0 ? (
              <div className="py-6 text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
                <Link
                  href="/recurring"
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  + {t('upcomingPayments')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recurringPayments.slice(0, 4).map((recurring) => {
                  const nextRun = new Date(recurring.nextRunAt);
                  const now = new Date();
                  const diffMs = nextRun.getTime() - now.getTime();
                  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
                  const diffHours = Math.floor(diffMins / 60);
                  const diffDays = Math.floor(diffHours / 24);

                  let countdown = '';
                  if (diffDays > 0) {
                    countdown = `${diffDays}d ${diffHours % 24}h`;
                  } else if (diffHours > 0) {
                    countdown = `${diffHours}h ${diffMins % 60}m`;
                  } else if (diffMins > 0) {
                    countdown = `${diffMins}m`;
                  } else {
                    countdown = 'Now';
                  }

                  return (
                    <Link
                      key={recurring.id}
                      href="/recurring"
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/15 to-pink-500/15 shrink-0">
                        <RefreshCw className="h-4 w-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {recurring.contact?.name || t('unknownContact')}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono text-foreground">
                            {formatValue(recurring.amountSat)}
                          </span>
                          <span>•</span>
                          <span>
                            {recurring.frequency === 'daily'
                              ? 'Daily'
                              : recurring.frequency === 'weekly'
                                ? 'Weekly'
                                : recurring.frequency === 'monthly'
                                  ? 'Monthly'
                                  : recurring.frequency}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10">
                        <Clock className="h-3 w-3 text-purple-500" />
                        <span className="text-[11px] font-mono text-purple-500">{countdown}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </Link>
                  );
                })}
                {recurringPayments.length > 4 && (
                  <Link
                    href="/recurring"
                    className="block text-center py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    +{recurringPayments.length - 4} more recurring
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Node Info + Recent Payments */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Node Info */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">{t('nodeInfo')}</h3>
              </div>
              <Link
                href="/node"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                {tc('viewAll')} <ChevronRight className="h-3 w-3" />
              </Link>
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

            <div className="grid grid-cols-2 gap-2 mb-3">
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

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Link
                href="/node?tab=info"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Server className="h-4 w-4 text-primary" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {t('details')}
                </span>
              </Link>
              <Link
                href="/node?tab=logs"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <ScrollText className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {t('logs')}
                </span>
              </Link>
              <Link
                href="/node?tab=terminal"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <Terminal className="h-4 w-4 text-green-500" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {t('terminal')}
                </span>
              </Link>
            </div>

            {/* External Links */}
            <div className="grid grid-cols-3 gap-2">
              <a
                href="https://phoenix.acinq.co/server/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  <BookOpen className="h-4 w-4 text-purple-500" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {tc('phoenixdDocs')}
                </span>
              </a>
              <a
                href="https://github.com/ACINQ/phoenixd"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-gray-500/10 flex items-center justify-center group-hover:bg-gray-500/20 transition-colors">
                  <Github className="h-4 w-4 text-gray-400" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {tc('phoenixd')}
                </span>
              </a>
              <a
                href="https://github.com/MiguelMedeiros/phoenixd-dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-gray-500/10 flex items-center justify-center group-hover:bg-gray-500/20 transition-colors">
                  <Github className="h-4 w-4 text-gray-400" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {tc('dashboard')}
                </span>
              </a>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="lg:col-span-3 glass-card rounded-2xl p-4 flex flex-col max-h-[380px]">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h3 className="font-semibold text-sm">{t('recentPayments')}</h3>
              <Link
                href="/payments"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                {tc('viewAll')} <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <PaymentList
                payments={recentPayments}
                formatValue={formatValue}
                variant="compact"
                limit={15}
                showCategories={false}
                showFees={false}
                showArrow={true}
                showDetailsDialog={true}
                emptyIcon="zap"
                emptyMessage={t('noPayments')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
