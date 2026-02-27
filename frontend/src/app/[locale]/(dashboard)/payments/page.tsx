'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownUp,
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
  Search,
  X,
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
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  // ALL payments (fetched once on load, used for stats and search)
  const allIncomingRef = useRef<IncomingPayment[]>([]);
  const allOutgoingRef = useRef<OutgoingPayment[]>([]);

  // Fixed stats (calculated once from ALL payments, never changes with pagination)
  const [fixedStatsReceived, setFixedStatsReceived] = useState(0);
  const [fixedStatsSent, setFixedStatsSent] = useState(0);
  const [fixedStatsFees, setFixedStatsFees] = useState(0);

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
      // Fetch ALL payments (for accurate stats) plus node info and categories
      const [allIncoming, allOutgoing, nodeInfo, cats] = await Promise.all([
        getIncomingPayments({ all: true }),
        getOutgoingPayments({ all: true }),
        getNodeInfo(),
        getCategories(),
      ]);

      // Sort by newest first
      const sortedIncoming = sortByNewest(allIncoming || []);
      const sortedOutgoing = sortByNewest(allOutgoing || []);

      // Store ALL payments in refs (for search and stats)
      allIncomingRef.current = sortedIncoming;
      allOutgoingRef.current = sortedOutgoing;

      // Calculate fixed stats from ALL payments (these never change with pagination)
      setFixedStatsReceived(
        sortedIncoming.filter((p) => p.isPaid).reduce((acc, p) => acc + p.receivedSat, 0)
      );
      setFixedStatsSent(sortedOutgoing.filter((p) => p.isPaid).reduce((acc, p) => acc + p.sent, 0));
      setFixedStatsFees(
        Math.floor(
          sortedOutgoing.filter((p) => p.isPaid).reduce((acc, p) => acc + p.fees, 0) / 1000
        )
      );

      // Only keep first page for display (infinite scroll loads the rest)
      setIncomingPayments(sortedIncoming.slice(0, PAGE_SIZE));
      setOutgoingPayments(sortedOutgoing.slice(0, PAGE_SIZE));
      setChain(nodeInfo.chain || 'mainnet');
      setCategories(cats || []);

      // Set hasMore flags
      setHasMoreIncoming(sortedIncoming.length > PAGE_SIZE);
      setHasMoreOutgoing(sortedOutgoing.length > PAGE_SIZE);

      // Fetch metadata for ALL payments (needed for search across all data)
      const paymentHashes = sortedIncoming.map((p) => p.paymentHash).filter(Boolean);
      const paymentIds = sortedOutgoing.map((p) => p.paymentId).filter(Boolean);

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

  // Load more for "all" tab (loads both)
  const loadMoreAll = useCallback(async () => {
    const promises: Promise<void>[] = [];
    if (hasMoreIncoming && !loadingMoreIncoming) promises.push(loadMoreIncoming());
    if (hasMoreOutgoing && !loadingMoreOutgoing) promises.push(loadMoreOutgoing());
    await Promise.all(promises);
  }, [
    hasMoreIncoming,
    hasMoreOutgoing,
    loadingMoreIncoming,
    loadingMoreOutgoing,
    loadMoreIncoming,
    loadMoreOutgoing,
  ]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const loadMore =
      activeTab === 'all'
        ? loadMoreAll
        : activeTab === 'incoming'
          ? loadMoreIncoming
          : loadMoreOutgoing;
    const hasMore =
      activeTab === 'all'
        ? hasMoreIncoming || hasMoreOutgoing
        : activeTab === 'incoming'
          ? hasMoreIncoming
          : hasMoreOutgoing;
    const isLoading =
      activeTab === 'all'
        ? loadingMoreIncoming || loadingMoreOutgoing
        : activeTab === 'incoming'
          ? loadingMoreIncoming
          : loadingMoreOutgoing;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Disable infinite scroll when searching (search only works on already loaded data)
    if (searchQuery.trim()) return;

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
    loading,
    searchQuery,
    loadMoreAll,
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

  // Use fixed stats (calculated once from ALL payments on initial load)
  const totalReceived = fixedStatsReceived;
  const totalSent = fixedStatsSent;
  const totalFees = fixedStatsFees;

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

  // Search helper: check if a payment matches the search query
  const matchesSearch = (payment: Payment, query: string): boolean => {
    if (!query) return true;
    const q = query.toLowerCase();

    const isIncoming = 'receivedSat' in payment;

    // Match amount (sats)
    if (isIncoming) {
      const incoming = payment as IncomingPayment;
      if (String(incoming.receivedSat).includes(q)) return true;
      if (incoming.requestedSat && String(incoming.requestedSat).includes(q)) return true;
    } else {
      const outgoing = payment as OutgoingPayment;
      if (String(outgoing.sent).includes(q)) return true;
    }

    // Match description / payer note
    if ('description' in payment && payment.description?.toLowerCase().includes(q)) return true;
    if ('payerNote' in payment && (payment as IncomingPayment).payerNote?.toLowerCase().includes(q))
      return true;

    // Match payment hash / id
    if ('paymentHash' in payment && payment.paymentHash?.toLowerCase().includes(q)) return true;
    if ('paymentId' in payment && (payment as OutgoingPayment).paymentId?.toLowerCase().includes(q))
      return true;

    // Match type / subType
    if (payment.type?.toLowerCase().includes(q)) return true;
    if (payment.subType?.toLowerCase().includes(q)) return true;

    // Match invoice
    if ('invoice' in payment && payment.invoice?.toLowerCase().includes(q)) return true;

    // Match preimage
    if ('preimage' in payment && payment.preimage?.toLowerCase().includes(q)) return true;

    // Match txId (on-chain)
    if ('txId' in payment && (payment as OutgoingPayment).txId?.toLowerCase().includes(q))
      return true;

    // Match metadata note
    const identifier = isIncoming
      ? (payment as IncomingPayment).paymentHash
      : (payment as OutgoingPayment).paymentId;
    if (identifier) {
      const metadata = paymentMetadataMap[identifier];
      if (metadata?.note?.toLowerCase().includes(q)) return true;
      // Match category names
      if (metadata?.categories?.some((c) => c.name.toLowerCase().includes(q))) return true;
    }

    // Match date
    const timestamp = payment.completedAt || payment.createdAt;
    if (timestamp) {
      const dateStr = new Date(timestamp).toLocaleString().toLowerCase();
      if (dateStr.includes(q)) return true;
    }

    return false;
  };

  // Filter payments by search and category
  const getFilteredPayments = (): Payment[] => {
    const isSearching = searchQuery.trim().length > 0;

    // When searching, use ALL payments (from refs); otherwise use paginated data
    let payments: Payment[];
    if (activeTab === 'all') {
      const incoming = isSearching ? allIncomingRef.current : incomingPayments;
      const outgoing = isSearching ? allOutgoingRef.current : outgoingPayments;
      payments = sortByNewest([...incoming, ...outgoing]);
    } else if (activeTab === 'incoming') {
      payments = isSearching ? allIncomingRef.current : incomingPayments;
    } else {
      payments = isSearching ? allOutgoingRef.current : outgoingPayments;
    }

    // Apply search filter
    if (isSearching) {
      payments = payments.filter((payment) => matchesSearch(payment, searchQuery.trim()));
    }

    // Apply category filter
    if (!selectedCategoryFilter) return payments;

    return payments.filter((payment) => {
      const isIncoming = 'receivedSat' in payment;
      const identifier = isIncoming
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
                id: 'all',
                label: t('all'),
                icon: ArrowDownUp,
                activeClassName:
                  'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25',
              },
              {
                id: 'incoming',
                label: t('incoming'),
                icon: ArrowDownToLine,
                activeClassName:
                  'bg-gradient-to-r from-success to-emerald-600 text-white shadow-lg shadow-success/25',
              },
              {
                id: 'outgoing',
                label: t('outgoing'),
                icon: ArrowUpFromLine,
                activeClassName:
                  'bg-gradient-to-r from-primary to-orange-600 text-white shadow-lg shadow-primary/25',
              },
            ] as TabItem[]
          }
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as 'all' | 'incoming' | 'outgoing')}
        />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full glass-card rounded-xl py-2.5 pl-10 pr-10 text-sm bg-transparent border border-white/[0.06] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

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
                  {searchQuery.trim() ? (
                    <Search className="h-10 w-10 text-muted-foreground" />
                  ) : activeTab === 'all' ? (
                    <ArrowDownUp className="h-10 w-10 text-muted-foreground" />
                  ) : activeTab === 'incoming' ? (
                    <ArrowDownToLine className="h-10 w-10 text-muted-foreground" />
                  ) : (
                    <ArrowUpFromLine className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <p className="text-lg text-muted-foreground">
                  {searchQuery.trim()
                    ? t('noSearchResults')
                    : activeTab === 'all'
                      ? t('noPayments')
                      : activeTab === 'incoming'
                        ? t('noIncomingPayments')
                        : t('noOutgoingPayments')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {currentPayments.map((payment, index) => {
                const isIncoming = 'receivedSat' in payment;
                let key: string;
                let metadata: PaymentMetadata | undefined;

                if (isIncoming) {
                  const incoming = payment as IncomingPayment;
                  key = incoming.paymentHash;
                  metadata = paymentMetadataMap[incoming.paymentHash];
                } else {
                  const outgoing = payment as OutgoingPayment;
                  key = outgoing.paymentId;
                  // Check both paymentId and paymentHash for backwards compatibility
                  metadata =
                    paymentMetadataMap[outgoing.paymentId] ||
                    (outgoing.paymentHash ? paymentMetadataMap[outgoing.paymentHash] : undefined);
                }

                return (
                  <PaymentListItem
                    key={key}
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

              {/* Infinite Scroll Loader (hidden during search) */}
              {!selectedCategoryFilter && !searchQuery.trim() && (
                <div ref={loadMoreRef} className="py-4">
                  {(activeTab === 'all'
                    ? loadingMoreIncoming || loadingMoreOutgoing
                    : activeTab === 'incoming'
                      ? loadingMoreIncoming
                      : loadingMoreOutgoing) && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">{tc('loading')}</span>
                    </div>
                  )}
                  {!(activeTab === 'all'
                    ? hasMoreIncoming || hasMoreOutgoing
                    : activeTab === 'incoming'
                      ? hasMoreIncoming
                      : hasMoreOutgoing) &&
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
