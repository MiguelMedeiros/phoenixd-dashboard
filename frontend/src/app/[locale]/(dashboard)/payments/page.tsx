'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Loader2,
  Copy,
  Check,
  Zap,
  Clock,
  Hash,
  FileText,
  Key,
  Calendar,
  ChevronRight,
  Receipt,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import {
  getIncomingPayments,
  getOutgoingPayments,
  exportPayments,
  getNodeInfo,
  type IncomingPayment,
  type OutgoingPayment,
} from '@/lib/api';
import { cn, getMempoolUrl } from '@/lib/utils';
import { useCurrencyContext } from '@/components/currency-provider';
import { useToast } from '@/hooks/use-toast';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardGrid } from '@/components/stat-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';

type Payment = IncomingPayment | OutgoingPayment;

export default function PaymentsPage() {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const tt = useTranslations('toast');
  const te = useTranslations('errors');
  const { formatValue } = useCurrencyContext();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incomingPayments, setIncomingPayments] = useState<IncomingPayment[]>([]);
  const [outgoingPayments, setOutgoingPayments] = useState<OutgoingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [chain, setChain] = useState<string>('mainnet');
  const { toast } = useToast();
  const { copiedField, copy: copyToClipboard } = useCopyToClipboard();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incoming, outgoing, nodeInfo] = await Promise.all([
          getIncomingPayments({ limit: 50 }),
          getOutgoingPayments({ limit: 50 }),
          getNodeInfo(),
        ]);
        setIncomingPayments(incoming || []);
        setOutgoingPayments(outgoing || []);
        setChain(nodeInfo.chain || 'mainnet');
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast({
          variant: 'destructive',
          title: tc('error'),
          description: te('failedToLoadPayments'),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await exportPayments();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t('exported'), description: t('paymentsExported') });
    } catch {
      toast({ variant: 'destructive', title: tc('error'), description: t('exportFailed') });
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatShortDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return t('yesterday');
    } else if (days < 7) {
      return t('daysAgo', { days });
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash) return '';
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  // Calculate stats
  const totalReceived = incomingPayments
    .filter((p) => p.isPaid)
    .reduce((acc, p) => acc + p.receivedSat, 0);
  const totalSent = outgoingPayments.filter((p) => p.isPaid).reduce((acc, p) => acc + p.sent, 0);
  // Note: fees come from phoenixd API in millisatoshis (msat), need to convert to sats
  const totalFees = Math.floor(
    outgoingPayments.filter((p) => p.isPaid).reduce((acc, p) => acc + p.fees, 0) / 1000
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-white/5 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 w-full rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const currentPayments = activeTab === 'incoming' ? incomingPayments : outgoingPayments;

  return (
    <>
      <div className="pt-4 md:pt-6 space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')}>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="glass-card flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-medium text-xs md:text-sm hover:bg-white/10 transition-all shrink-0"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{t('exportCsv')}</span>
          </button>
        </PageHeader>

        {/* Stats */}
        <StatCardGrid columns={3}>
          <StatCard
            label={t('received')}
            value={formatValue(totalReceived)}
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            label={t('sent')}
            value={formatValue(totalSent)}
            icon={TrendingDown}
            variant="primary"
          />
          <StatCard label={t('fees')} value={formatValue(totalFees)} icon={Zap} variant="muted" />
        </StatCardGrid>

        {/* Tab Switcher */}
        <PageTabs
          tabs={
            [
              {
                id: 'incoming',
                label: t('incoming'),
                icon: ArrowDownToLine,
                count: incomingPayments.length,
                activeClassName:
                  'bg-gradient-to-r from-success to-emerald-600 text-white shadow-lg shadow-success/25',
              },
              {
                id: 'outgoing',
                label: t('outgoing'),
                icon: ArrowUpFromLine,
                count: outgoingPayments.length,
                activeClassName:
                  'bg-gradient-to-r from-primary to-orange-600 text-white shadow-lg shadow-primary/25',
              },
            ] as TabItem[]
          }
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as 'incoming' | 'outgoing')}
        />

        {/* Payment List */}
        <div>
          {currentPayments.length === 0 ? (
            <div className="glass-card rounded-3xl p-16 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                  {activeTab === 'incoming' ? (
                    <ArrowDownToLine className="h-10 w-10 text-muted-foreground" />
                  ) : (
                    <ArrowUpFromLine className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <p className="text-lg text-muted-foreground">
                  {activeTab === 'incoming' ? t('noIncomingPayments') : t('noOutgoingPayments')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTab === 'incoming'
                ? incomingPayments.map((payment, index) => (
                    <button
                      key={payment.paymentHash}
                      onClick={() => setSelectedPayment(payment)}
                      className="w-full glass-card rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 hover:bg-white/[0.08] transition-all text-left group"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-10 w-10 md:h-14 md:w-14 items-center justify-center rounded-xl md:rounded-2xl shrink-0 transition-transform group-hover:scale-110',
                          payment.isPaid
                            ? 'bg-gradient-to-br from-success/20 to-emerald-600/20'
                            : 'bg-yellow-500/10'
                        )}
                      >
                        <ArrowDownToLine
                          className={cn(
                            'h-4 w-4 md:h-6 md:w-6',
                            payment.isPaid ? 'text-success' : 'text-yellow-500'
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 md:gap-3 mb-0.5 md:mb-1">
                          <span className="font-bold text-sm md:text-lg text-success">
                            +{formatValue(payment.receivedSat)}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 rounded-full font-medium',
                              payment.isPaid
                                ? 'bg-success/10 text-success'
                                : 'bg-yellow-500/10 text-yellow-500'
                            )}
                          >
                            {payment.isPaid ? t('received') : tc('pending')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" />
                          <span className="truncate">
                            {formatShortDate(payment.completedAt || payment.createdAt)}
                            {payment.description && ` • ${payment.description}`}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </button>
                  ))
                : outgoingPayments.map((payment, index) => (
                    <button
                      key={payment.paymentId}
                      onClick={() => setSelectedPayment(payment)}
                      className="w-full glass-card rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 hover:bg-white/[0.08] transition-all text-left group"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-10 w-10 md:h-14 md:w-14 items-center justify-center rounded-xl md:rounded-2xl shrink-0 transition-transform group-hover:scale-110',
                          payment.isPaid
                            ? 'bg-gradient-to-br from-primary/20 to-orange-600/20'
                            : 'bg-yellow-500/10'
                        )}
                      >
                        <ArrowUpFromLine
                          className={cn(
                            'h-4 w-4 md:h-6 md:w-6',
                            payment.isPaid ? 'text-primary' : 'text-yellow-500'
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 md:gap-3 mb-0.5 md:mb-1 flex-wrap">
                          <span className="font-bold text-sm md:text-lg">
                            -{formatValue(payment.sent)}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 rounded-full font-medium',
                              payment.isPaid
                                ? 'bg-success/10 text-success'
                                : 'bg-yellow-500/10 text-yellow-500'
                            )}
                          >
                            {payment.isPaid ? t('sent') : tc('pending')}
                          </span>
                          {payment.fees > 0 && (
                            <span className="text-[10px] md:text-xs text-muted-foreground hidden sm:inline">
                              {t('fee')}: {formatValue(Math.floor(payment.fees / 1000))}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" />
                          {formatShortDate(payment.completedAt || payment.createdAt)}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </button>
                  ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Details Modal */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-12 w-12 rounded-xl flex items-center justify-center',
                  selectedPayment && 'paymentHash' in selectedPayment
                    ? 'bg-gradient-to-br from-success/20 to-emerald-600/20'
                    : 'bg-gradient-to-br from-primary/20 to-orange-600/20'
                )}
              >
                {selectedPayment && 'paymentHash' in selectedPayment ? (
                  <ArrowDownToLine className="h-6 w-6 text-success" />
                ) : (
                  <ArrowUpFromLine className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl">{t('paymentDetails')}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedPayment && 'paymentHash' in selectedPayment
                    ? t('incomingPayment')
                    : t('outgoingPayment')}
                </p>
              </div>
            </div>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-6 mt-4">
              {/* Amount */}
              <div className="text-center py-6 glass-card rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent">
                {'receivedSat' in selectedPayment ? (
                  <p className="text-4xl font-bold text-success">
                    +{formatValue(selectedPayment.receivedSat)}
                  </p>
                ) : (
                  <p className="text-4xl font-bold">-{formatValue(selectedPayment.sent)}</p>
                )}
                {'fees' in selectedPayment && selectedPayment.fees > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('fee')}: {formatValue(Math.floor(selectedPayment.fees / 1000))}
                  </p>
                )}
              </div>

              {/* Details Grid */}
              <div className="space-y-3">
                {/* Status */}
                <DetailRow
                  icon={<Zap className="h-4 w-4" />}
                  label={t('status')}
                  value={
                    <span
                      className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium',
                        selectedPayment.isPaid
                          ? 'bg-success/10 text-success'
                          : 'bg-yellow-500/10 text-yellow-500'
                      )}
                    >
                      {selectedPayment.isPaid
                        ? 'receivedSat' in selectedPayment
                          ? t('received')
                          : t('sent')
                        : tc('pending')}
                    </span>
                  }
                />

                {/* Type */}
                <DetailRow
                  icon={<Receipt className="h-4 w-4" />}
                  label={t('type')}
                  value={`${selectedPayment.type} / ${selectedPayment.subType}`}
                />

                {/* Date */}
                <DetailRow
                  icon={<Calendar className="h-4 w-4" />}
                  label={t('date')}
                  value={formatDate(selectedPayment.completedAt || selectedPayment.createdAt)}
                />

                {/* Description */}
                {'description' in selectedPayment && selectedPayment.description && (
                  <DetailRow
                    icon={<FileText className="h-4 w-4" />}
                    label={tc('description')}
                    value={selectedPayment.description}
                  />
                )}

                {/* Payment Hash */}
                {'paymentHash' in selectedPayment && selectedPayment.paymentHash && (
                  <DetailRow
                    icon={<Hash className="h-4 w-4" />}
                    label={t('paymentHash')}
                    value={truncateHash(selectedPayment.paymentHash)}
                    copyable
                    fullValue={selectedPayment.paymentHash}
                    onCopy={() => copyToClipboard(selectedPayment.paymentHash!, 'hash')}
                    copied={copiedField === 'hash'}
                  />
                )}

                {/* Payment ID (for outgoing) */}
                {'paymentId' in selectedPayment && (
                  <DetailRow
                    icon={<Hash className="h-4 w-4" />}
                    label={t('paymentId')}
                    value={truncateHash(selectedPayment.paymentId)}
                    copyable
                    fullValue={selectedPayment.paymentId}
                    onCopy={() => copyToClipboard(selectedPayment.paymentId, 'id')}
                    copied={copiedField === 'id'}
                  />
                )}

                {/* Preimage */}
                {'preimage' in selectedPayment && selectedPayment.preimage && (
                  <DetailRow
                    icon={<Key className="h-4 w-4" />}
                    label={t('preimage')}
                    value={truncateHash(selectedPayment.preimage)}
                    copyable
                    fullValue={selectedPayment.preimage}
                    onCopy={() => copyToClipboard(selectedPayment.preimage!, 'preimage')}
                    copied={copiedField === 'preimage'}
                  />
                )}

                {/* Invoice */}
                {'invoice' in selectedPayment && selectedPayment.invoice && (
                  <div className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {tc('invoice')}
                      </div>
                      <button
                        onClick={() => copyToClipboard(selectedPayment.invoice!, 'invoice')}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        {copiedField === 'invoice' ? (
                          <>
                            <Check className="h-3 w-3" />
                            {tt('copied')}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            {tc('copy')}
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs font-mono bg-black/30 p-3 rounded-lg break-all text-muted-foreground">
                      {selectedPayment.invoice}
                    </p>
                  </div>
                )}

                {/* TX ID (for on-chain) */}
                {'txId' in selectedPayment && selectedPayment.txId && (
                  <DetailRow
                    icon={<ExternalLink className="h-4 w-4" />}
                    label={t('transactionId')}
                    value={truncateHash(selectedPayment.txId)}
                    copyable
                    fullValue={selectedPayment.txId}
                    onCopy={() => copyToClipboard(selectedPayment.txId!, 'txid')}
                    copied={copiedField === 'txid'}
                    link={getMempoolUrl(chain, selectedPayment.txId)}
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Detail Row Component
function DetailRow({
  icon,
  label,
  value,
  copyable,
  fullValue,
  onCopy,
  copied,
  link,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  fullValue?: string;
  onCopy?: () => void;
  copied?: boolean;
  link?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="text-sm font-medium">{value}</span>
        )}
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={fullValue}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
