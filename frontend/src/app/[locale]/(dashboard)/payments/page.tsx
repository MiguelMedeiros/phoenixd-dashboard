'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Loader2,
  Copy,
  Check,
  Zap,
  Hash,
  FileText,
  Key,
  Calendar,
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
  getCategories,
  batchGetPaymentMetadata,
  updatePaymentMetadata,
  type IncomingPayment,
  type OutgoingPayment,
  type PaymentCategory,
  type PaymentMetadata,
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
import { CategoryManager } from '@/components/category-manager';
import { PaymentNoteEditor } from '@/components/payment-note-editor';
import { PaymentListItem } from '@/components/payment-list-item';

type Payment = IncomingPayment | OutgoingPayment;

const PAGE_SIZE = 20;

// Sort payments by timestamp (newest first)
function sortByNewest<T extends { completedAt?: number; createdAt: number }>(payments: T[]): T[] {
  return [...payments].sort((a, b) => {
    const aTime = a.completedAt || a.createdAt;
    const bTime = b.completedAt || b.createdAt;
    return bTime - aTime; // Descending order (newest first)
  });
}

export default function PaymentsPage() {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const tt = useTranslations('toast');
  const te = useTranslations('errors');
  const tl = useTranslations('paymentLabels');
  const tcat = useTranslations('categories');
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

  // Infinite scroll state
  const [loadingMoreIncoming, setLoadingMoreIncoming] = useState(false);
  const [loadingMoreOutgoing, setLoadingMoreOutgoing] = useState(false);
  const [hasMoreIncoming, setHasMoreIncoming] = useState(true);
  const [hasMoreOutgoing, setHasMoreOutgoing] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Category and metadata state
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [paymentMetadataMap, setPaymentMetadataMap] = useState<Record<string, PaymentMetadata>>({});
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [selectedPaymentMetadata, setSelectedPaymentMetadata] = useState<PaymentMetadata | null>(
    null
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [incoming, outgoing, nodeInfo, cats] = await Promise.all([
        getIncomingPayments({ limit: PAGE_SIZE }),
        getOutgoingPayments({ limit: PAGE_SIZE }),
        getNodeInfo(),
        getCategories(),
      ]);

      // Sort by newest first
      const sortedIncoming = sortByNewest(incoming || []);
      const sortedOutgoing = sortByNewest(outgoing || []);

      setIncomingPayments(sortedIncoming);
      setOutgoingPayments(sortedOutgoing);
      setChain(nodeInfo.chain || 'mainnet');
      setCategories(cats || []);

      // Set hasMore flags
      setHasMoreIncoming((incoming || []).length >= PAGE_SIZE);
      setHasMoreOutgoing((outgoing || []).length >= PAGE_SIZE);

      // Fetch metadata for all payments
      const paymentHashes = (incoming || []).map((p) => p.paymentHash).filter(Boolean);
      const paymentIds = (outgoing || []).map((p) => p.paymentId).filter(Boolean);

      if (paymentHashes.length > 0 || paymentIds.length > 0) {
        try {
          const metadata = await batchGetPaymentMetadata({ paymentHashes, paymentIds });
          setPaymentMetadataMap(metadata);
        } catch {
          // Ignore metadata fetch errors - it's optional
        }
      }
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
  }, [toast, tc, te]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing payments data...');
      setTimeout(fetchData, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchData]);

  // Load more incoming payments
  const loadMoreIncoming = useCallback(async () => {
    if (loadingMoreIncoming || !hasMoreIncoming) return;

    setLoadingMoreIncoming(true);
    try {
      const newPayments = await getIncomingPayments({
        limit: PAGE_SIZE,
        offset: incomingPayments.length,
      });

      if (newPayments && newPayments.length > 0) {
        const sortedNew = sortByNewest(newPayments);
        // Merge and sort all payments together
        setIncomingPayments((prev) => {
          const combined = [...prev, ...sortedNew];
          // Remove duplicates by paymentHash
          const unique = combined.filter(
            (payment, index, self) =>
              index === self.findIndex((p) => p.paymentHash === payment.paymentHash)
          );
          return sortByNewest(unique);
        });

        // Fetch metadata for new payments
        const paymentHashes = newPayments.map((p) => p.paymentHash).filter(Boolean);
        if (paymentHashes.length > 0) {
          try {
            const metadata = await batchGetPaymentMetadata({ paymentHashes, paymentIds: [] });
            setPaymentMetadataMap((prev) => ({ ...prev, ...metadata }));
          } catch {
            // Ignore metadata fetch errors
          }
        }

        setHasMoreIncoming(newPayments.length >= PAGE_SIZE);
      } else {
        setHasMoreIncoming(false);
      }
    } catch (error) {
      console.error('Failed to load more incoming payments:', error);
    } finally {
      setLoadingMoreIncoming(false);
    }
  }, [loadingMoreIncoming, hasMoreIncoming, incomingPayments.length]);

  // Load more outgoing payments
  const loadMoreOutgoing = useCallback(async () => {
    if (loadingMoreOutgoing || !hasMoreOutgoing) return;

    setLoadingMoreOutgoing(true);
    try {
      const newPayments = await getOutgoingPayments({
        limit: PAGE_SIZE,
        offset: outgoingPayments.length,
      });

      if (newPayments && newPayments.length > 0) {
        const sortedNew = sortByNewest(newPayments);
        // Merge and sort all payments together
        setOutgoingPayments((prev) => {
          const combined = [...prev, ...sortedNew];
          // Remove duplicates by paymentId
          const unique = combined.filter(
            (payment, index, self) =>
              index === self.findIndex((p) => p.paymentId === payment.paymentId)
          );
          return sortByNewest(unique);
        });

        // Fetch metadata for new payments
        const paymentIds = newPayments.map((p) => p.paymentId).filter(Boolean);
        if (paymentIds.length > 0) {
          try {
            const metadata = await batchGetPaymentMetadata({ paymentHashes: [], paymentIds });
            setPaymentMetadataMap((prev) => ({ ...prev, ...metadata }));
          } catch {
            // Ignore metadata fetch errors
          }
        }

        setHasMoreOutgoing(newPayments.length >= PAGE_SIZE);
      } else {
        setHasMoreOutgoing(false);
      }
    } catch (error) {
      console.error('Failed to load more outgoing payments:', error);
    } finally {
      setLoadingMoreOutgoing(false);
    }
  }, [loadingMoreOutgoing, hasMoreOutgoing, outgoingPayments.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const loadMore = activeTab === 'incoming' ? loadMoreIncoming : loadMoreOutgoing;
    const hasMore = activeTab === 'incoming' ? hasMoreIncoming : hasMoreOutgoing;
    const isLoading = activeTab === 'incoming' ? loadingMoreIncoming : loadingMoreOutgoing;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!hasMore || isLoading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    activeTab,
    loadMoreIncoming,
    loadMoreOutgoing,
    hasMoreIncoming,
    hasMoreOutgoing,
    loadingMoreIncoming,
    loadingMoreOutgoing,
  ]);

  // Update selected payment metadata when payment changes
  useEffect(() => {
    if (selectedPayment) {
      // Use 'receivedSat' to determine if it's incoming (only IncomingPayment has receivedSat)
      const isIncoming = 'receivedSat' in selectedPayment;
      if (isIncoming) {
        const paymentHash = (selectedPayment as IncomingPayment).paymentHash;
        setSelectedPaymentMetadata(paymentMetadataMap[paymentHash] || null);
      } else {
        // For outgoing payments, check both paymentId and paymentHash for backwards compatibility
        // (old data was saved with paymentHash instead of paymentId)
        const outgoing = selectedPayment as OutgoingPayment;
        const metadata =
          paymentMetadataMap[outgoing.paymentId] ||
          (outgoing.paymentHash ? paymentMetadataMap[outgoing.paymentHash] : null);
        setSelectedPaymentMetadata(metadata || null);
      }
    } else {
      setSelectedPaymentMetadata(null);
    }
  }, [selectedPayment, paymentMetadataMap]);

  const handleUpdateMetadata = async (
    identifier: string,
    isIncoming: boolean,
    updates: { note?: string | null; categoryIds?: string[] }
  ) => {
    try {
      const updated = await updatePaymentMetadata(identifier, { ...updates, isIncoming });
      setPaymentMetadataMap((prev) => ({
        ...prev,
        [identifier]: updated,
      }));
      setSelectedPaymentMetadata(updated);
    } catch (error) {
      console.error('Failed to update payment metadata:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: 'Failed to update payment',
      });
    }
  };

  // Toggle a category for the selected payment
  const handleToggleCategory = async (categoryId: string) => {
    if (!selectedPayment) return;

    const isIncoming = 'receivedSat' in selectedPayment;
    const identifier = isIncoming
      ? (selectedPayment as IncomingPayment).paymentHash
      : (selectedPayment as OutgoingPayment).paymentId;

    if (!identifier) return;

    const currentCategoryIds = selectedPaymentMetadata?.categories?.map((c) => c.id) || [];
    const isSelected = currentCategoryIds.includes(categoryId);

    const newCategoryIds = isSelected
      ? currentCategoryIds.filter((id) => id !== categoryId)
      : [...currentCategoryIds, categoryId];

    await handleUpdateMetadata(identifier, isIncoming, { categoryIds: newCategoryIds });
  };

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

  // Filter payments by category if selected
  const getFilteredPayments = () => {
    const payments = activeTab === 'incoming' ? incomingPayments : outgoingPayments;
    if (!selectedCategoryFilter) return payments;

    return payments.filter((payment) => {
      // For incoming payments, use paymentHash. For outgoing, use paymentId.
      const identifier =
        activeTab === 'incoming'
          ? (payment as IncomingPayment).paymentHash
          : (payment as OutgoingPayment).paymentId;
      if (!identifier) return false;
      const metadata = paymentMetadataMap[identifier];
      return metadata?.categories?.some((c) => c.id === selectedCategoryFilter) || false;
    });
  };

  const currentPayments = getFilteredPayments();

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

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{tl('category')}:</span>
            <button
              onClick={() => setSelectedCategoryFilter(null)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                !selectedCategoryFilter
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              )}
            >
              {tc('viewAll')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setSelectedCategoryFilter(cat.id === selectedCategoryFilter ? null : cat.id)
                }
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                  selectedCategoryFilter === cat.id
                    ? 'ring-2 ring-offset-2 ring-offset-background'
                    : 'hover:opacity-80'
                )}
                style={{
                  backgroundColor: `${cat.color}20`,
                  color: cat.color,
                  ...(selectedCategoryFilter === cat.id && { ringColor: cat.color }),
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => setShowCategoryManager(true)}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {tcat('manageCategories')}
            </button>
          </div>
        )}

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
                ? (currentPayments as IncomingPayment[]).map((payment, index) => {
                    const metadata = paymentMetadataMap[payment.paymentHash];
                    return (
                      <PaymentListItem
                        key={payment.paymentHash}
                        payment={payment}
                        metadata={metadata}
                        formatValue={formatValue}
                        onClick={() => setSelectedPayment(payment)}
                        variant="default"
                        showCategories={true}
                        showFees={true}
                        showArrow={true}
                        animationDelay={index * 30}
                      />
                    );
                  })
                : (currentPayments as OutgoingPayment[]).map((payment, index) => {
                    // Check both paymentId and paymentHash for backwards compatibility
                    // (old data was saved with paymentHash instead of paymentId)
                    const metadata =
                      paymentMetadataMap[payment.paymentId] ||
                      (payment.paymentHash ? paymentMetadataMap[payment.paymentHash] : undefined);
                    return (
                      <PaymentListItem
                        key={payment.paymentId}
                        payment={payment}
                        metadata={metadata}
                        formatValue={formatValue}
                        onClick={() => setSelectedPayment(payment)}
                        variant="default"
                        showCategories={true}
                        showFees={true}
                        showArrow={true}
                        animationDelay={index * 30}
                      />
                    );
                  })}

              {/* Infinite Scroll Loader */}
              {!selectedCategoryFilter && (
                <div ref={loadMoreRef} className="py-4">
                  {(activeTab === 'incoming' ? loadingMoreIncoming : loadingMoreOutgoing) && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">{tc('loading')}</span>
                    </div>
                  )}
                  {!(activeTab === 'incoming' ? hasMoreIncoming : hasMoreOutgoing) &&
                    currentPayments.length > 0 && (
                      <p className="text-center text-sm text-muted-foreground">
                        {t('allPaymentsLoaded')}
                      </p>
                    )}
                </div>
              )}
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

              {/* Note & Category */}
              <div className="space-y-4">
                {/* Note Editor */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                    {tl('note')}
                  </label>
                  <PaymentNoteEditor
                    note={selectedPaymentMetadata?.note}
                    onSave={async (note) => {
                      // Use 'receivedSat' to determine if it's incoming (only IncomingPayment has receivedSat)
                      const isIncoming = 'receivedSat' in selectedPayment;
                      const identifier = isIncoming
                        ? (selectedPayment as IncomingPayment).paymentHash
                        : (selectedPayment as OutgoingPayment).paymentId;
                      if (identifier) {
                        await handleUpdateMetadata(identifier, isIncoming, { note });
                      }
                    }}
                  />
                </div>

                {/* Category Selector - Multi-select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {tl('category')}
                    </label>
                    <button
                      onClick={() => setShowCategoryManager(true)}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      {categories.length === 0 ? tcat('addCategory') : tcat('manage')}
                    </button>
                  </div>

                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tcat('noCategories')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat) => {
                        const isSelected =
                          selectedPaymentMetadata?.categories?.some((c) => c.id === cat.id) ||
                          false;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => handleToggleCategory(cat.id)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                              isSelected
                                ? 'ring-2 ring-offset-2 ring-offset-background'
                                : 'opacity-60 hover:opacity-100'
                            )}
                            style={{
                              backgroundColor: `${cat.color}20`,
                              color: cat.color,
                              ...(isSelected && { ringColor: cat.color }),
                            }}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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

      {/* Category Manager */}
      <CategoryManager
        open={showCategoryManager}
        onClose={() => {
          setShowCategoryManager(false);
          // Refresh categories
          getCategories().then(setCategories).catch(console.error);
        }}
      />
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
