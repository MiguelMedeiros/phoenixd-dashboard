'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  User,
  Loader2,
  Edit2,
  ChevronDown,
  ChevronUp,
  ArrowUpFromLine,
  Repeat,
  Play,
  Pause,
  XCircle,
  Timer,
  Zap,
  CheckCircle,
  PauseCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RecurringPaymentForm } from '@/components/recurring-payment-form';
import { useToast } from '@/hooks/use-toast';
import {
  getContacts,
  getRecurringPayments,
  getRecurringPaymentExecutions,
  createRecurringPayment,
  updateRecurringPayment,
  deleteRecurringPayment,
  getCategories,
  getOutgoingPayment,
  updatePaymentMetadata,
  getPaymentMetadata,
  type Contact,
  type PaymentMetadata,
  type RecurringPayment,
  type RecurringPaymentExecution,
  type RecurringPaymentFrequency,
  type PaymentCategory,
  type OutgoingPayment,
} from '@/lib/api';
import { PaymentDetailsDialog } from '@/components/payment-details-dialog';
import { CategoryManager } from '@/components/category-manager';
import { StatCard, StatCardGrid } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { wsEvents, WS_EVENTS } from '@/lib/websocket-events';
import { cn } from '@/lib/utils';

export default function RecurringPage() {
  const t = useTranslations('recurringPayments');
  const tc = useTranslations('common');
  const tp = useTranslations('payments');
  const { toast } = useToast();

  const [allRecurringPayments, setAllRecurringPayments] = useState<RecurringPayment[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringPayment | null>(null);
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // Recurring payment executions state
  const [recurringExecutions, setRecurringExecutions] = useState<
    Record<string, RecurringPaymentExecution[]>
  >({});
  const recurringExecutionsRef = useRef<Record<string, RecurringPaymentExecution[]>>({});
  recurringExecutionsRef.current = recurringExecutions;
  const [loadingExecutions, setLoadingExecutions] = useState<string | null>(null);
  const [loadingMoreExecutions, setLoadingMoreExecutions] = useState<string | null>(null);
  const [hasMoreExecutions, setHasMoreExecutions] = useState<Record<string, boolean>>({});
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});
  const EXECUTIONS_PER_PAGE = 10;

  // Payment details dialog
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentMetadata | null>(null);
  const [fullPaymentDetails, setFullPaymentDetails] = useState<OutgoingPayment | null>(null);
  const [selectedContactForDetail, setSelectedContactForDetail] = useState<Contact | null>(null);

  // Countdown state
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  // Selected contact for creating new recurring payment
  const [selectedContactForForm, setSelectedContactForForm] = useState<Contact | null>(null);

  // Format countdown
  const formatCountdown = useCallback(
    (nextRunAt: Date | string): string => {
      const now = new Date();
      const diff = new Date(nextRunAt).getTime() - now.getTime();

      if (diff <= 0) return t('runningNow');

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}d ${hours % 24}h`;
      } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    },
    [t]
  );

  // Fetch all recurring payments
  const fetchRecurringPayments = useCallback(async () => {
    try {
      const data = await getRecurringPayments({});
      setAllRecurringPayments(data);
    } catch (error) {
      console.error('Failed to load recurring payments:', error);
    }
  }, []);

  // Fetch all contacts
  const fetchContacts = useCallback(async () => {
    try {
      const data = await getContacts();
      setAllContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRecurringPayments(), fetchContacts(), fetchCategories()]);
      setLoading(false);
    };
    loadData();
  }, [fetchRecurringPayments, fetchContacts, fetchCategories]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing recurring payments...');
      setTimeout(() => {
        fetchRecurringPayments();
        fetchContacts();
        fetchCategories();
      }, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchRecurringPayments, fetchContacts, fetchCategories]);

  // Listen for recurring payment executions
  useEffect(() => {
    const unsubscribe = wsEvents.on(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, () => {
      fetchRecurringPayments();
    });

    return unsubscribe;
  }, [fetchRecurringPayments]);

  // Update countdowns every second
  useEffect(() => {
    const updateCountdowns = async () => {
      const newCountdowns: Record<string, string> = {};
      let hasExpired = false;

      allRecurringPayments.forEach((recurring) => {
        if (recurring.status === 'active') {
          const countdown = formatCountdown(recurring.nextRunAt);
          newCountdowns[recurring.id] = countdown;

          const diff = new Date(recurring.nextRunAt).getTime() - new Date().getTime();
          if (diff <= 0) {
            hasExpired = true;
          }
        }
      });
      setCountdowns(newCountdowns);

      // Refresh if any countdown expired
      const now = Date.now();
      if (hasExpired && now - lastRefreshTime > 5000) {
        setLastRefreshTime(now);
        await fetchRecurringPayments();

        // Refresh expanded executions
        for (const recurring of allRecurringPayments) {
          if (expandedHistories[recurring.id]) {
            try {
              const currentExecutions = recurringExecutionsRef.current[recurring.id] || [];
              const newExecutions = await getRecurringPaymentExecutions(recurring.id, {
                limit: EXECUTIONS_PER_PAGE,
              });

              if (newExecutions.length > 0) {
                const firstExecutionId =
                  currentExecutions.length > 0 ? currentExecutions[0].id : null;
                let newItems: typeof newExecutions = [];

                if (firstExecutionId) {
                  const firstOldIndex = newExecutions.findIndex((e) => e.id === firstExecutionId);
                  if (firstOldIndex > 0) {
                    newItems = newExecutions.slice(0, firstOldIndex);
                  } else if (firstOldIndex === -1) {
                    newItems = newExecutions;
                  }
                } else {
                  newItems = newExecutions;
                }

                if (newItems.length > 0 || currentExecutions.length === 0) {
                  setRecurringExecutions((prev) => ({
                    ...prev,
                    [recurring.id]: [
                      ...newItems,
                      ...currentExecutions.filter((e) => !newItems.some((n) => n.id === e.id)),
                    ],
                  }));
                }
              }
            } catch (error) {
              console.error('Failed to refresh executions:', error);
            }
          }
        }
      }
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [
    allRecurringPayments,
    formatCountdown,
    lastRefreshTime,
    expandedHistories,
    fetchRecurringPayments,
  ]);

  // Fetch executions for a recurring payment
  const fetchRecurringExecutions = async (recurringId: string, loadMore = false) => {
    const currentExecutions = recurringExecutions[recurringId] || [];
    const offset = loadMore ? currentExecutions.length : 0;

    if (loadMore) {
      setLoadingMoreExecutions(recurringId);
    } else {
      setLoadingExecutions(recurringId);
      setExpandedHistories((prev) => ({ ...prev, [recurringId]: true }));
    }

    try {
      const executions = await getRecurringPaymentExecutions(recurringId, {
        limit: EXECUTIONS_PER_PAGE,
        offset,
      });

      setRecurringExecutions((prev) => ({
        ...prev,
        [recurringId]: loadMore ? [...currentExecutions, ...executions] : executions,
      }));

      setHasMoreExecutions((prev) => ({
        ...prev,
        [recurringId]: executions.length === EXECUTIONS_PER_PAGE,
      }));
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    } finally {
      setLoadingExecutions(null);
      setLoadingMoreExecutions(null);
    }
  };

  // Toggle history visibility
  const toggleHistoryVisibility = (recurringId: string) => {
    setExpandedHistories((prev) => ({ ...prev, [recurringId]: !prev[recurringId] }));
  };

  // Fetch payment details from execution
  const handleSelectExecution = async (
    exec: RecurringPaymentExecution,
    contact: Contact | null
  ) => {
    if (!exec.paymentId || exec.status !== 'success') return;

    setSelectedContactForDetail(contact);

    try {
      let metadata: PaymentMetadata;
      try {
        metadata = await getPaymentMetadata(exec.paymentId);
      } catch {
        metadata = {
          id: exec.id,
          paymentId: exec.paymentId,
          paymentHash: exec.paymentHash || null,
          note: null,
          contactId: contact?.id || null,
          categories: [],
          createdAt: exec.executedAt,
          updatedAt: exec.executedAt,
        };
      }

      setSelectedPaymentDetail(metadata);
      const fullDetails = await getOutgoingPayment(exec.paymentId);
      setFullPaymentDetails(fullDetails);
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
    }
  };

  // Handle metadata update from dialog
  const handleUpdatePaymentMetadata = async (updates: {
    note?: string | null;
    categoryIds?: string[];
  }) => {
    if (!selectedPaymentDetail) return;

    const identifier = selectedPaymentDetail.paymentHash || selectedPaymentDetail.paymentId;
    if (!identifier) return;

    const isIncoming = !!selectedPaymentDetail.paymentHash;

    try {
      const updated = await updatePaymentMetadata(identifier, {
        ...updates,
        isIncoming,
      });
      setSelectedPaymentDetail(updated);
    } catch (error) {
      console.error('Failed to update payment metadata:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: 'Failed to update payment',
      });
    }
  };

  // Toggle category on payment
  const handleTogglePaymentCategory = async (categoryId: string) => {
    if (!selectedPaymentDetail) return;

    const currentCategoryIds = selectedPaymentDetail.categories?.map((c) => c.id) || [];
    const isSelected = currentCategoryIds.includes(categoryId);

    const newCategoryIds = isSelected
      ? currentCategoryIds.filter((id) => id !== categoryId)
      : [...currentCategoryIds, categoryId];

    await handleUpdatePaymentMetadata({ categoryIds: newCategoryIds });
  };

  // Handle create recurring
  const handleCreateRecurring = async (data: {
    contactId: string;
    addressId: string;
    amountSat: number;
    frequency: RecurringPaymentFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    note?: string;
    categoryIds?: string[];
  }) => {
    setSaving(true);
    try {
      const backendData = {
        ...data,
        categoryId: data.categoryIds?.[0],
      };
      await createRecurringPayment(backendData);
      toast({ title: tc('success'), description: t('created') });
      setShowForm(false);
      setSelectedContactForForm(null);
      fetchRecurringPayments();
    } catch (error) {
      console.error('Failed to create recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle recurring status
  const handleToggleRecurring = async (recurring: RecurringPayment) => {
    try {
      const newStatus = recurring.status === 'active' ? 'paused' : 'active';
      await updateRecurringPayment(recurring.id, { status: newStatus });
      toast({
        title: tc('success'),
        description: newStatus === 'paused' ? t('paused') : t('resumed'),
      });
      fetchRecurringPayments();
    } catch (error) {
      console.error('Failed to toggle recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  // Handle edit recurring
  const handleEditRecurring = async (data: {
    contactId: string;
    addressId: string;
    amountSat: number;
    frequency: RecurringPaymentFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    note?: string;
    categoryIds?: string[];
  }) => {
    if (!editingRecurring) return;

    setSaving(true);
    try {
      const backendData = {
        amountSat: data.amountSat,
        addressId: data.addressId,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        timeOfDay: data.timeOfDay,
        note: data.note,
        categoryId: data.categoryIds?.[0],
      };
      await updateRecurringPayment(editingRecurring.id, backendData);
      toast({ title: tc('success'), description: t('updated') });
      setEditingRecurring(null);
      fetchRecurringPayments();
    } catch (error) {
      console.error('Failed to update recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete recurring
  const handleDeleteRecurring = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await deleteRecurringPayment(id);
      toast({ title: tc('success'), description: t('deleted') });
      fetchRecurringPayments();
    } catch (error) {
      console.error('Failed to delete recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  // Get frequency label
  const getFrequencyLabel = (recurring: RecurringPayment) => {
    switch (recurring.frequency) {
      case 'every_minute':
        return t('every_minute');
      case 'every_5_minutes':
        return t('every_5_minutes');
      case 'every_15_minutes':
        return t('every_15_minutes');
      case 'every_30_minutes':
        return t('every_30_minutes');
      case 'hourly':
        return t('hourly');
      case 'daily':
        return t('everyDay');
      case 'weekly':
        return t('everyWeek');
      case 'monthly':
        return t('everyMonth');
      default:
        return recurring.frequency;
    }
  };

  // Stats
  const stats = useMemo(() => {
    const active = allRecurringPayments.filter((p) => p.status === 'active').length;
    const paused = allRecurringPayments.filter((p) => p.status === 'paused').length;
    const totalPaid = allRecurringPayments.reduce((sum, p) => sum + (p.totalPaid || 0), 0);

    // Find next scheduled payment
    const activePayments = allRecurringPayments.filter((p) => p.status === 'active');
    let nextScheduled: RecurringPayment | null = null;
    if (activePayments.length > 0) {
      nextScheduled = activePayments.reduce((earliest, current) => {
        return new Date(current.nextRunAt) < new Date(earliest.nextRunAt) ? current : earliest;
      });
    }

    return { active, paused, totalPaid, nextScheduled };
  }, [allRecurringPayments]);

  // Contacts with payable addresses
  const contactsWithPayableAddresses = useMemo(() => {
    return allContacts.filter((c) =>
      c.addresses.some((a) => a.type === 'lightning_address' || a.type === 'bolt12_offer')
    );
  }, [allContacts]);

  if (loading) {
    return (
      <div className="space-y-4 pt-4 md:pt-6">
        <div className="h-8 w-32 bg-white/5 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 w-full rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-4 md:pt-6 space-y-4">
        {/* Header */}
        <PageHeader title={t('title')} subtitle={t('subtitle')}>
          <button
            onClick={() => setShowForm(true)}
            disabled={contactsWithPayableAddresses.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('addRecurring')}</span>
          </button>
        </PageHeader>

        {/* Stats Cards */}
        <StatCardGrid columns={4}>
          <StatCard label={t('active')} value={stats.active} icon={CheckCircle} variant="success" />
          <StatCard label={t('paused')} value={stats.paused} icon={PauseCircle} variant="muted" />
          <StatCard
            label={t('totalPaid')}
            value={`${stats.totalPaid.toLocaleString()} sats`}
            icon={Zap}
            variant="primary"
          />
          <StatCard
            label={t('nextPayment')}
            value={stats.nextScheduled ? countdowns[stats.nextScheduled.id] || '...' : '-'}
            icon={Timer}
            variant="accent"
          />
        </StatCardGrid>

        {/* Recurring Payments List */}
        <div>
          {allRecurringPayments.length === 0 ? (
            <div className="py-12 text-center">
              <Repeat className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">{t('noRecurringPayments')}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {t('noRecurringPaymentsDescription')}
              </p>
              {contactsWithPayableAddresses.length > 0 && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 text-primary text-sm hover:underline"
                >
                  + {t('addRecurring')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {allRecurringPayments.map((recurring) => (
                <div
                  key={recurring.id}
                  className={cn(
                    'rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] overflow-hidden transition-all',
                    recurring.status === 'paused' && 'opacity-60'
                  )}
                >
                  {/* Main Row */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    {/* Contact Avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent/15 shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {recurring.contact?.name || 'Unknown'}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full',
                            recurring.status === 'active' && 'bg-success/10 text-success',
                            recurring.status === 'paused' && 'bg-yellow-500/10 text-yellow-500'
                          )}
                        >
                          {t(recurring.status)}
                        </span>
                        {recurring.connection && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400"
                            title={`Node: ${recurring.connection.name}`}
                          >
                            {recurring.connection.isDocker ? '🐳' : '🌐'}{' '}
                            {recurring.connection.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {recurring.amountSat.toLocaleString()} sats
                        </span>
                        <span>•</span>
                        <span>{getFrequencyLabel(recurring)}</span>
                        {recurring.paymentCount > 0 && (
                          <>
                            <span>•</span>
                            <span>
                              {recurring.paymentCount} {tc('payments').toLowerCase()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Countdown */}
                    {recurring.status === 'active' && countdowns[recurring.id] && (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-primary bg-primary/10 px-2 py-1 rounded-lg shrink-0">
                        <Timer className="h-3 w-3" />
                        {countdowns[recurring.id]}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingRecurring(recurring)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                        title={tc('edit')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleRecurring(recurring)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                        title={recurring.status === 'active' ? t('pause') : t('resume')}
                      >
                        {recurring.status === 'active' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteRecurring(recurring.id)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title={tc('delete')}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Error Display */}
                  {recurring.lastError && (
                    <div className="px-4 pb-2">
                      <p
                        className="text-[11px] text-destructive truncate"
                        title={recurring.lastError}
                      >
                        {recurring.lastError}
                      </p>
                    </div>
                  )}

                  {/* Payment History */}
                  {recurring.paymentCount > 0 && (
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => {
                          if (recurringExecutions[recurring.id]) {
                            toggleHistoryVisibility(recurring.id);
                          } else {
                            fetchRecurringExecutions(recurring.id);
                          }
                        }}
                        className="w-full rounded-lg p-2.5 flex items-center justify-between bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors group"
                      >
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          {t('executions')} ({recurring.paymentCount})
                        </span>
                        {loadingExecutions === recurring.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : expandedHistories[recurring.id] ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                      </button>

                      {expandedHistories[recurring.id] && recurringExecutions[recurring.id] && (
                        <div className="mt-1.5 space-y-0.5 pl-3 border-l-2 border-white/[0.06]">
                          {(recurringExecutions[recurring.id] || []).map((exec) => (
                            <button
                              key={exec.id}
                              onClick={() => {
                                if (exec.status === 'success' && exec.paymentId) {
                                  handleSelectExecution(exec, recurring.contact || null);
                                }
                              }}
                              disabled={exec.status !== 'success' || !exec.paymentId}
                              className={cn(
                                'w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left',
                                exec.status === 'success' && exec.paymentId
                                  ? 'hover:bg-white/5 cursor-pointer'
                                  : 'opacity-70 cursor-default'
                              )}
                            >
                              {/* Icon */}
                              <div
                                className={cn(
                                  'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                  exec.status === 'success' ? 'bg-primary/10' : 'bg-destructive/10'
                                )}
                              >
                                {exec.status === 'success' ? (
                                  <ArrowUpFromLine className="h-4 w-4 text-primary" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">
                                  {exec.status === 'success' ? tp('sent') : t('failed')}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {new Date(exec.executedAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                  {exec.status !== 'success' &&
                                    exec.errorMessage &&
                                    ` • ${exec.errorMessage}`}
                                </p>
                              </div>

                              {/* Amount */}
                              <p
                                className={cn(
                                  'font-mono text-sm font-semibold tabular-nums',
                                  exec.status === 'success' ? 'text-foreground' : 'text-destructive'
                                )}
                              >
                                {exec.status === 'success'
                                  ? `-${exec.amountSat.toLocaleString()} sats`
                                  : t('failed')}
                              </p>

                              {/* Arrow for clickable items */}
                              {exec.status === 'success' && exec.paymentId && (
                                <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg] shrink-0" />
                              )}
                            </button>
                          ))}
                          {hasMoreExecutions[recurring.id] && (
                            <button
                              onClick={() => fetchRecurringExecutions(recurring.id, true)}
                              disabled={loadingMoreExecutions === recurring.id}
                              className="w-full py-2 text-xs text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {loadingMoreExecutions === recurring.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {tc('loading')}
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  {tc('more')}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Recurring Payment Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setSelectedContactForForm(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              {t('addRecurring')}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {!selectedContactForForm ? (
              <div className="space-y-3">
                <label className="text-sm font-medium">{t('selectContact')}</label>
                {contactsWithPayableAddresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noPayableAddresses')}</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {contactsWithPayableAddresses.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => setSelectedContactForForm(contact)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/10 transition-colors text-left"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent/15 shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">{contact.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {
                              contact.addresses.filter(
                                (a) => a.type === 'lightning_address' || a.type === 'bolt12_offer'
                              ).length
                            }{' '}
                            payable addresses
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="pt-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="w-full px-4 py-2 rounded-xl glass-card hover:bg-white/10 transition-colors text-sm font-medium"
                  >
                    {tc('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedContactForForm(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    ← {t('selectContact')}
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {t('schedulingFor', { contact: selectedContactForForm.name })}
                  </span>
                </div>
                <RecurringPaymentForm
                  contact={selectedContactForForm}
                  categories={categories}
                  onSubmit={handleCreateRecurring}
                  onCancel={() => {
                    setShowForm(false);
                    setSelectedContactForForm(null);
                  }}
                  onManageCategories={() => setShowCategoryManager(true)}
                  loading={saving}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Recurring Payment Dialog */}
      <Dialog open={!!editingRecurring} onOpenChange={(open) => !open && setEditingRecurring(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              {t('editRecurring')}
            </DialogTitle>
            {editingRecurring?.contact && (
              <p className="text-sm text-muted-foreground">
                {t('editingFor', { contact: editingRecurring.contact.name })}
              </p>
            )}
          </DialogHeader>
          <div className="mt-4">
            {editingRecurring?.contact && (
              <RecurringPaymentForm
                contact={editingRecurring.contact}
                categories={categories}
                editingPayment={editingRecurring}
                onSubmit={handleEditRecurring}
                onCancel={() => setEditingRecurring(null)}
                onManageCategories={() => setShowCategoryManager(true)}
                loading={saving}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Detail Dialog */}
      <PaymentDetailsDialog
        open={!!selectedPaymentDetail && !!fullPaymentDetails}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPaymentDetail(null);
            setFullPaymentDetails(null);
            setSelectedContactForDetail(null);
          }
        }}
        payment={fullPaymentDetails}
        metadata={selectedPaymentDetail}
        categories={categories}
        contact={selectedContactForDetail}
        onUpdateNote={async (note) => {
          await handleUpdatePaymentMetadata({ note });
        }}
        onToggleCategory={handleTogglePaymentCategory}
        onManageCategories={() => setShowCategoryManager(true)}
        formatValue={(value) => `₿ ${value.toLocaleString()}`}
      />

      {/* Category Manager */}
      <CategoryManager
        open={showCategoryManager}
        onClose={() => {
          setShowCategoryManager(false);
          getCategories().then(setCategories).catch(console.error);
        }}
      />
    </>
  );
}
