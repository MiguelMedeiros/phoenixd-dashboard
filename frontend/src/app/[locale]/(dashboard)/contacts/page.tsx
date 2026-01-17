'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  User,
  AtSign,
  Hash,
  Gift,
  Loader2,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  ArrowUpFromLine,
  Star,
  Repeat,
  Play,
  Pause,
  XCircle,
  Timer,
  Zap,
  Send,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContactForm } from '@/components/contact-form';
import { RecurringPaymentForm } from '@/components/recurring-payment-form';
import { useToast } from '@/hooks/use-toast';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  getContactPayments,
  getRecurringPayments,
  getRecurringPaymentExecutions,
  createRecurringPayment,
  updateRecurringPayment,
  deleteRecurringPayment,
  executeRecurringPaymentNow,
  getCategories,
  getIncomingPayment,
  getOutgoingPayment,
  updatePaymentMetadata,
  payOffer,
  payLnAddress,
  getPaymentMetadata,
  type Contact,
  type ContactAddress,
  type PaymentMetadata,
  type CreateContactAddressInput,
  type RecurringPayment,
  type RecurringPaymentExecution,
  type RecurringPaymentFrequency,
  type PaymentCategory,
  type IncomingPayment,
  type OutgoingPayment,
} from '@/lib/api';
import { PaymentDetailsDialog } from '@/components/payment-details-dialog';
import { CategoryManager } from '@/components/category-manager';
import { StatCard, StatCardGrid } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { wsEvents, WS_EVENTS } from '@/lib/websocket-events';
import { cn } from '@/lib/utils';

export default function ContactsPage() {
  const t = useTranslations('contacts');
  const tc = useTranslations('common');
  const tr = useTranslations('recurringPayments');
  const { toast } = useToast();

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [_contactPayments, _setContactPayments] = useState<PaymentMetadata[]>([]);
  const [_loadingPayments, _setLoadingPayments] = useState(false);
  const [loadingMorePayments, setLoadingMorePayments] = useState(false);
  const [_hasMorePayments, _setHasMorePayments] = useState(false);
  const PAYMENTS_PER_PAGE = 10;

  // Recurring payments state - map by contact ID
  const [allRecurringPayments, setAllRecurringPayments] = useState<
    Record<string, RecurringPayment[]>
  >({});
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringPayment | null>(null);
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [_executingPaymentId, _setExecutingPaymentId] = useState<string | null>(null);

  // Recurring payment executions state
  const [recurringExecutions, setRecurringExecutions] = useState<
    Record<string, RecurringPaymentExecution[]>
  >({});
  const recurringExecutionsRef = useRef<Record<string, RecurringPaymentExecution[]>>({});
  // Keep ref in sync with state
  recurringExecutionsRef.current = recurringExecutions;
  const [loadingExecutions, setLoadingExecutions] = useState<string | null>(null);
  const [loadingMoreExecutions, setLoadingMoreExecutions] = useState<string | null>(null);
  const [hasMoreExecutions, setHasMoreExecutions] = useState<Record<string, boolean>>({});
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});
  const EXECUTIONS_PER_PAGE = 10;

  // Payment details dialog
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentMetadata | null>(null);
  const [fullPaymentDetails, setFullPaymentDetails] = useState<
    IncomingPayment | OutgoingPayment | null
  >(null);
  const [_loadingPaymentDetails, setLoadingPaymentDetails] = useState(false);

  // Countdown state
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  // Quick pay dialog state
  const [showQuickPayDialog, setShowQuickPayDialog] = useState(false);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayNote, setQuickPayNote] = useState('');
  const [quickPayLoading, setQuickPayLoading] = useState(false);
  const [selectedPaymentAddress, setSelectedPaymentAddress] = useState<ContactAddress | null>(null);

  // Label filter state
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null);

  // Fetch full payment details from PaymentMetadata (kept for future use)
  const _handleSelectPayment = async (payment: PaymentMetadata) => {
    setSelectedPaymentDetail(payment);
    setLoadingPaymentDetails(true);
    setFullPaymentDetails(null);

    try {
      if (payment.paymentHash) {
        // It's an incoming payment
        const fullDetails = await getIncomingPayment(payment.paymentHash);
        setFullPaymentDetails(fullDetails);
      } else if (payment.paymentId) {
        // It's an outgoing payment
        const fullDetails = await getOutgoingPayment(payment.paymentId);
        setFullPaymentDetails(fullDetails);
      }
    } catch (error) {
      console.error('Failed to fetch payment details:', error);
    } finally {
      setLoadingPaymentDetails(false);
    }
  };

  // Fetch payment details from execution (recurring payment history)
  const handleSelectExecution = async (exec: RecurringPaymentExecution) => {
    if (!exec.paymentId || exec.status !== 'success') return;

    setLoadingPaymentDetails(true);
    setFullPaymentDetails(null);

    try {
      // Try to get existing metadata
      let metadata: PaymentMetadata;
      try {
        metadata = await getPaymentMetadata(exec.paymentId);
      } catch {
        // If no metadata exists, create a temporary one for display
        metadata = {
          id: exec.id,
          paymentId: exec.paymentId,
          paymentHash: exec.paymentHash || null,
          note: null,
          contactId: selectedContact?.id || null,
          categories: [],
          createdAt: exec.executedAt,
          updatedAt: exec.executedAt,
        };
      }

      setSelectedPaymentDetail(metadata);

      // Fetch full payment details
      const fullDetails = await getOutgoingPayment(exec.paymentId);
      setFullPaymentDetails(fullDetails);
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
    } finally {
      setLoadingPaymentDetails(false);
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

      // Refresh contact payments (data not displayed but state updated)
      if (selectedContact) {
        const payments = await getContactPayments(selectedContact.id);
        _setContactPayments(payments);
      }
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

  // Format countdown
  const formatCountdown = useCallback(
    (nextRunAt: Date | string): string => {
      const now = new Date();
      const diff = new Date(nextRunAt).getTime() - now.getTime();

      if (diff <= 0) return tr('runningNow');

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
    [tr]
  );

  // Track last refresh time to avoid too frequent requests
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  // Update countdowns every second for all recurring payments
  useEffect(() => {
    const updateCountdowns = async () => {
      const newCountdowns: Record<string, string> = {};
      let expiredContactId: string | null = null;

      Object.entries(allRecurringPayments).forEach(([contactId, payments]) => {
        payments.forEach((recurring) => {
          if (recurring.status === 'active') {
            const countdown = formatCountdown(recurring.nextRunAt);
            newCountdowns[recurring.id] = countdown;

            // Check if countdown just expired (showing "Running now...")
            const diff = new Date(recurring.nextRunAt).getTime() - new Date().getTime();
            if (diff <= 0) {
              expiredContactId = contactId;
            }
          }
        });
      });
      setCountdowns(newCountdowns);

      // If any countdown expired and we haven't refreshed in the last 5 seconds, refetch
      const now = Date.now();
      if (expiredContactId && now - lastRefreshTime > 5000) {
        setLastRefreshTime(now);
        for (const contactId of Object.keys(allRecurringPayments)) {
          try {
            const data = await getRecurringPayments({ contactId });
            setAllRecurringPayments((prev) => ({ ...prev, [contactId]: data }));

            // Also refresh executions for any expanded recurring payments
            // We only fetch new executions and prepend them to preserve pagination
            for (const recurring of data) {
              if (expandedHistories[recurring.id]) {
                try {
                  const currentExecutions = recurringExecutionsRef.current[recurring.id] || [];
                  const firstExecutionId =
                    currentExecutions.length > 0 ? currentExecutions[0].id : null;

                  // Fetch only recent executions (first page)
                  const newExecutions = await getRecurringPaymentExecutions(recurring.id, {
                    limit: EXECUTIONS_PER_PAGE,
                  });

                  if (newExecutions.length > 0) {
                    // Find where the new executions end and old ones begin
                    let newItems: typeof newExecutions = [];
                    if (firstExecutionId) {
                      const firstOldIndex = newExecutions.findIndex(
                        (e) => e.id === firstExecutionId
                      );
                      if (firstOldIndex > 0) {
                        // There are new executions before the first old one
                        newItems = newExecutions.slice(0, firstOldIndex);
                      } else if (firstOldIndex === -1) {
                        // All fetched executions are new (rare case)
                        newItems = newExecutions;
                      }
                      // If firstOldIndex === 0, no new items
                    } else {
                      // No existing executions, use all fetched
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
          } catch (error) {
            console.error('Failed to refresh recurring payments:', error);
          }
        }
        // Also refresh payment history for the selected contact (state kept for consistency)
        if (selectedContact) {
          try {
            const payments = await getContactPayments(selectedContact.id, {
              limit: PAYMENTS_PER_PAGE,
            });
            _setContactPayments(payments);
            _setHasMorePayments(payments.length >= PAYMENTS_PER_PAGE);
          } catch (error) {
            console.error('Failed to refresh contact payments:', error);
          }
        }
      }
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 1000);
    return () => clearInterval(interval);
  }, [allRecurringPayments, formatCountdown, lastRefreshTime, selectedContact, expandedHistories]);

  // Fetch all recurring payments for stats
  const fetchAllRecurringPayments = useCallback(async () => {
    try {
      // Fetch all recurring payments without contact filter
      const data = await getRecurringPayments({});
      // Group by contactId
      const grouped: Record<string, RecurringPayment[]> = {};
      data.forEach((payment) => {
        if (!grouped[payment.contactId]) {
          grouped[payment.contactId] = [];
        }
        grouped[payment.contactId].push(payment);
      });
      setAllRecurringPayments(grouped);
    } catch (error) {
      console.error('Failed to load recurring payments:', error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContacts();
      setAllContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: 'Failed to load contacts',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tc]);

  // Fetch all contacts, categories, and recurring payments on mount
  useEffect(() => {
    fetchContacts();
    fetchCategories();
    fetchAllRecurringPayments();
  }, [fetchContacts, fetchCategories, fetchAllRecurringPayments]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing contacts data...');
      setTimeout(() => {
        fetchContacts();
        fetchCategories();
        fetchAllRecurringPayments();
      }, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchContacts, fetchCategories, fetchAllRecurringPayments]);

  // Listen for recurring payment executions to refresh stats
  useEffect(() => {
    const unsubscribe = wsEvents.on(WS_EVENTS.RECURRING_PAYMENT_EXECUTED, () => {
      // Refresh contacts to update payment counts
      fetchContacts();
      // Refresh all recurring payments for stats
      fetchAllRecurringPayments();
    });

    return unsubscribe;
  }, [fetchContacts, fetchAllRecurringPayments]);

  // Filter contacts locally for instant search and label filter
  const contacts = useMemo(() => {
    let filtered = allContacts;

    // Apply label filter first
    if (selectedLabelFilter) {
      filtered = filtered.filter((c) => c.label === selectedLabelFilter);
    }

    // Then apply search
    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.label?.toLowerCase().includes(lower) ||
          c.addresses.some((a) => a.address.toLowerCase().includes(lower))
      );
    }

    return filtered;
  }, [allContacts, search, selectedLabelFilter]);

  // Note: contactPayments is no longer displayed in UI,
  // but function kept for potential future use and to not break other calls
  const _fetchContactPayments = async (contactId: string, reset = true) => {
    if (reset) {
      _setLoadingPayments(true);
      _setContactPayments([]);
    } else {
      setLoadingMorePayments(true);
    }

    try {
      const offset = reset ? 0 : _contactPayments.length;
      const data = await getContactPayments(contactId, {
        limit: PAYMENTS_PER_PAGE + 1,
        offset,
      });

      const hasMore = data.length > PAYMENTS_PER_PAGE;
      _setHasMorePayments(hasMore);

      const paymentsToAdd = hasMore ? data.slice(0, PAYMENTS_PER_PAGE) : data;

      if (reset) {
        _setContactPayments(paymentsToAdd);
      } else {
        _setContactPayments((prev) => [...prev, ...paymentsToAdd]);
      }
    } catch (error) {
      console.error('Failed to load contact payments:', error);
    } finally {
      _setLoadingPayments(false);
      setLoadingMorePayments(false);
    }
  };

  const _loadMorePayments = () => {
    if (selectedContact && !loadingMorePayments) {
      _fetchContactPayments(selectedContact.id, false);
    }
  };
  // Suppress unused warnings
  void _loadMorePayments;

  const fetchContactRecurring = async (contactId: string) => {
    setLoadingRecurring(true);
    try {
      const data = await getRecurringPayments({ contactId });
      setAllRecurringPayments((prev) => ({ ...prev, [contactId]: data }));
    } catch (error) {
      console.error('Failed to load recurring payments:', error);
    } finally {
      setLoadingRecurring(false);
    }
  };

  const handleCreate = async (data: {
    name: string;
    label?: string;
    avatarUrl?: string;
    addresses: CreateContactAddressInput[];
  }) => {
    setSaving(true);
    try {
      await createContact(data);
      toast({ title: tc('success'), description: t('contactCreated') });
      setShowForm(false);
      await fetchContacts();
    } catch (error) {
      console.error('Failed to create contact:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: {
    name: string;
    label?: string;
    avatarUrl?: string;
    addresses: CreateContactAddressInput[];
  }) => {
    if (!editingContact) return;
    setSaving(true);
    try {
      const updatedContact = await updateContact(editingContact.id, data);
      toast({ title: tc('success'), description: t('contactUpdated') });
      setEditingContact(null);

      // Update selectedContact if it's the one being edited
      if (selectedContact?.id === editingContact.id) {
        setSelectedContact(updatedContact);
      }

      await fetchContacts();
    } catch (error) {
      console.error('Failed to update contact:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await deleteContact(id);
      toast({ title: tc('success'), description: t('contactDeleted') });
      setSelectedContact(null);
      await fetchContacts();
    } catch (error) {
      console.error('Failed to delete contact:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  const handleQuickPay = async () => {
    if (!selectedContact || !quickPayAmount) return;

    const amount = parseInt(quickPayAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: t('invalidAmount'),
      });
      return;
    }

    // Use selected address or find primary address or first available
    const paymentAddress =
      selectedPaymentAddress ||
      selectedContact.addresses.find((a) => a.isPrimary) ||
      selectedContact.addresses[0];
    if (!paymentAddress) {
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: t('noPaymentAddress'),
      });
      return;
    }

    setQuickPayLoading(true);
    try {
      if (paymentAddress.type === 'bolt12_offer') {
        await payOffer({
          offer: paymentAddress.address,
          amountSat: amount,
          message: quickPayNote || undefined,
        });
      } else if (paymentAddress.type === 'lightning_address') {
        await payLnAddress({
          address: paymentAddress.address,
          amountSat: amount,
          message: quickPayNote || undefined,
        });
      } else {
        toast({
          variant: 'destructive',
          title: tc('error'),
          description: t('unsupportedPaymentType'),
        });
        return;
      }

      toast({
        title: tc('success'),
        description: t('paymentSent', { amount, name: selectedContact.name }),
      });
      setShowQuickPayDialog(false);
      setQuickPayAmount('');
      setQuickPayNote('');
      setSelectedPaymentAddress(null);

      // Refresh payments
      if (selectedContact) {
        _fetchContactPayments(selectedContact.id, true);
      }
    } catch (error) {
      console.error('Quick pay failed:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setQuickPayLoading(false);
    }
  };

  const openContactDetail = (contact: Contact) => {
    setSelectedContact(contact);
    _fetchContactPayments(contact.id);
    fetchContactRecurring(contact.id);
  };

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
      // Convert categoryIds to categoryId for backend compatibility (first one)
      const backendData = {
        ...data,
        categoryId: data.categoryIds?.[0],
      };
      await createRecurringPayment(backendData);
      toast({ title: tc('success'), description: tr('created') });
      setShowRecurringForm(false);
      // Refresh all recurring payments to update stats
      fetchAllRecurringPayments();
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

  // Fetch executions for a recurring payment
  const fetchRecurringExecutions = async (recurringId: string, loadMore = false) => {
    const currentExecutions = recurringExecutions[recurringId] || [];
    const offset = loadMore ? currentExecutions.length : 0;

    if (loadMore) {
      setLoadingMoreExecutions(recurringId);
    } else {
      setLoadingExecutions(recurringId);
      // Mark as expanded when loading for the first time
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

  const handleToggleRecurring = async (recurring: RecurringPayment) => {
    try {
      const newStatus = recurring.status === 'active' ? 'paused' : 'active';
      await updateRecurringPayment(recurring.id, { status: newStatus });
      toast({
        title: tc('success'),
        description: newStatus === 'paused' ? tr('paused') : tr('resumed'),
      });
      // Refresh all recurring payments to update stats
      fetchAllRecurringPayments();
    } catch (error) {
      console.error('Failed to toggle recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

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
      // Convert categoryIds to categoryId for backend compatibility (first one)
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
      toast({ title: tc('success'), description: tr('updated') });
      setEditingRecurring(null);
      // Refresh all recurring payments to update stats
      fetchAllRecurringPayments();
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

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm(tr('confirmDelete'))) return;
    try {
      await deleteRecurringPayment(id);
      toast({ title: tc('success'), description: tr('deleted') });
      // Refresh all recurring payments to update stats
      fetchAllRecurringPayments();
    } catch (error) {
      console.error('Failed to delete recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  const _handleExecuteNow = async (id: string) => {
    _setExecutingPaymentId(id);
    try {
      const result = await executeRecurringPaymentNow(id);
      if (result.success) {
        toast({ title: tc('success'), description: tr('executionSuccess') });
        // Refresh all recurring payments to update stats
        fetchAllRecurringPayments();
        if (selectedContact) {
          _fetchContactPayments(selectedContact.id);
        }
      } else {
        toast({
          variant: 'destructive',
          title: tr('executionFailed'),
          description: result.error,
        });
      }
    } catch (error) {
      console.error('Failed to execute recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      _setExecutingPaymentId(null);
    }
  };

  const getFrequencyLabel = (recurring: RecurringPayment) => {
    switch (recurring.frequency) {
      case 'every_minute':
        return tr('every_minute');
      case 'every_5_minutes':
        return tr('every_5_minutes');
      case 'every_15_minutes':
        return tr('every_15_minutes');
      case 'every_30_minutes':
        return tr('every_30_minutes');
      case 'hourly':
        return tr('hourly');
      case 'daily':
        return tr('everyDay');
      case 'weekly':
        return tr('everyWeek');
      case 'monthly':
        return tr('everyMonth');
      default:
        return recurring.frequency;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lightning_address':
        return AtSign;
      case 'node_id':
        return Hash;
      case 'bolt12_offer':
        return Gift;
      default:
        return User;
    }
  };

  const _getTypeLabel = (type: string) => {
    switch (type) {
      case 'lightning_address':
        return t('lightningAddress');
      case 'node_id':
        return t('nodeId');
      case 'bolt12_offer':
        return t('bolt12Offer');
      default:
        return type;
    }
  };

  // Sort addresses by type in a consistent order: Lightning Address > BOLT12 > Node ID
  const sortAddresses = (addresses: ContactAddress[]) => {
    const typeOrder: Record<string, number> = {
      lightning_address: 1,
      bolt12_offer: 2,
      node_id: 3,
    };
    return [...addresses].sort((a, b) => {
      // Primary addresses come first within their type
      if (a.type === b.type) {
        return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
      }
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
  };

  // Stats - count unique types across all contacts
  const totalContacts = allContacts.length;

  const stats = useMemo(() => {
    let lnAddresses = 0;
    let bolt12Offers = 0;
    let nodeIds = 0;
    let totalPayments = 0;
    let activeRecurring = 0;

    allContacts.forEach((contact) => {
      contact.addresses.forEach((addr) => {
        if (addr.type === 'lightning_address') lnAddresses++;
        else if (addr.type === 'bolt12_offer') bolt12Offers++;
        else if (addr.type === 'node_id') nodeIds++;
      });
      if (contact._count?.payments) {
        totalPayments += contact._count.payments;
      }
    });

    // Count only active recurring payments
    Object.values(allRecurringPayments).forEach((payments) => {
      payments.forEach((payment) => {
        if (payment.status === 'active') {
          activeRecurring++;
        }
      });
    });

    return { lnAddresses, bolt12Offers, nodeIds, totalPayments, activeRecurring };
  }, [allContacts, allRecurringPayments]);

  // Collect unique labels from contacts
  const uniqueLabels = useMemo(() => {
    const labels = new Set<string>();
    allContacts.forEach((contact) => {
      if (contact.label) {
        labels.add(contact.label);
      }
    });
    return Array.from(labels).sort();
  }, [allContacts]);

  if (loading && allContacts.length === 0) {
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('addContact')}</span>
          </button>
        </PageHeader>

        {/* Stats Cards */}
        {totalContacts > 0 && (
          <StatCardGrid columns={4}>
            <StatCard
              label="LN Address"
              value={stats.lnAddresses}
              icon={AtSign}
              variant="primary"
            />
            <StatCard label="BOLT12" value={stats.bolt12Offers} icon={Gift} variant="success" />
            <StatCard
              label={tc('recurring')}
              value={stats.activeRecurring}
              icon={Repeat}
              variant="accent"
            />
            <StatCard
              label={tc('payments')}
              value={stats.totalPayments}
              icon={Zap}
              variant="muted"
            />
          </StatCardGrid>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`${tc('search')} (${t('name')}, ${t('contactLabel').toLowerCase()}, ${t('address').toLowerCase()}...)`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
        </div>

        {/* Label Filter */}
        {uniqueLabels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{t('contactLabel')}:</span>
            <button
              onClick={() => setSelectedLabelFilter(null)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                !selectedLabelFilter
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              )}
            >
              {tc('viewAll')}
            </button>
            {uniqueLabels.map((label) => (
              <button
                key={label}
                onClick={() => setSelectedLabelFilter(label === selectedLabelFilter ? null : label)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                  selectedLabelFilter === label
                    ? 'bg-primary/20 text-primary ring-2 ring-primary/50 ring-offset-1 ring-offset-background'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                )}
              >
                <span className="w-2 h-2 rounded-full bg-current opacity-60" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Contact List */}
        <div>
          {contacts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">{search ? t('noResults') : t('noContacts')}</p>
              {!search && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-primary text-sm hover:underline"
                >
                  + {t('addContact')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => {
                const isExpanded = selectedContact?.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    className={cn(
                      'rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] hover:from-white/[0.06] hover:to-white/[0.03] hover:border-white/15 transition-all overflow-hidden',
                      isExpanded &&
                        'ring-1 ring-primary/30 border-primary/30 from-white/[0.05] to-white/[0.03]'
                    )}
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() => {
                        if (isExpanded) {
                          setSelectedContact(null);
                        } else {
                          openContactDetail(contact);
                        }
                      }}
                      className="w-full px-3 py-2.5 flex items-center gap-3 text-left group hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Avatar - smaller */}
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent/15 shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{contact.name}</span>
                          {contact.label && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-muted-foreground/80">
                              {contact.label}
                            </span>
                          )}
                        </div>
                        {/* Address type labels */}
                        <div className="flex items-center gap-1 mt-0.5">
                          {sortAddresses(contact.addresses).map((addr) => {
                            const Icon = getTypeIcon(addr.type);
                            const label =
                              addr.type === 'lightning_address'
                                ? 'LN'
                                : addr.type === 'node_id'
                                  ? 'Node'
                                  : 'BOLT12';
                            return (
                              <span
                                key={addr.id}
                                className={cn(
                                  'flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded',
                                  addr.type === 'lightning_address' && 'text-primary/70',
                                  addr.type === 'node_id' && 'text-muted-foreground/70',
                                  addr.type === 'bolt12_offer' && 'text-success/70',
                                  addr.isPrimary && 'font-medium'
                                )}
                              >
                                <Icon className="h-2.5 w-2.5" />
                                {label}
                                {addr.isPrimary && <Star className="h-2 w-2 fill-current" />}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Payment count */}
                      {contact._count && contact._count.payments > 0 && (
                        <span
                          className="text-[10px] text-muted-foreground/60 shrink-0 hidden sm:flex items-center gap-1"
                          title={`${contact._count.payments} ${t('payments')}`}
                        >
                          <Zap className="h-2.5 w-2.5" />
                          {contact._count.payments}
                        </span>
                      )}

                      {/* Actions - only on hover */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingContact(contact);
                          }}
                          className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground/60 hover:text-foreground"
                          title={t('edit')}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(contact.id);
                          }}
                          className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground/60 hover:text-destructive"
                          title={tc('delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Arrow */}
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all shrink-0',
                          isExpanded && 'rotate-180 text-primary'
                        )}
                      />
                    </button>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] space-y-5">
                          {/* Payment Methods */}
                          <div>
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              {t('paymentMethods')}
                            </h3>
                            <div className="space-y-2">
                              {sortAddresses(contact.addresses).map((addr) => {
                                const Icon = getTypeIcon(addr.type);
                                const canPay =
                                  addr.type === 'lightning_address' || addr.type === 'bolt12_offer';
                                return (
                                  <div
                                    key={addr.id}
                                    className="rounded-lg p-3 bg-white/[0.04] border border-white/[0.06]"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-xs font-medium">
                                            {addr.type === 'lightning_address'
                                              ? 'Lightning Address'
                                              : addr.type === 'node_id'
                                                ? 'Node ID'
                                                : 'BOLT12 Offer'}
                                          </span>
                                          {addr.isPrimary && (
                                            <Star className="h-3 w-3 text-primary fill-primary" />
                                          )}
                                        </div>
                                        <p className="font-mono text-xs break-all text-muted-foreground">
                                          {addr.address.length > 60
                                            ? `${addr.address.slice(0, 30)}...${addr.address.slice(-20)}`
                                            : addr.address}
                                        </p>
                                      </div>
                                      {canPay ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPaymentAddress(addr);
                                            setShowQuickPayDialog(true);
                                          }}
                                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                                        >
                                          <Send className="h-3 w-3" />
                                          {t('pay')}
                                        </button>
                                      ) : addr.type === 'node_id' ? (
                                        <span className="shrink-0 text-[10px] text-muted-foreground italic">
                                          {t('nodeIdNoPayment')}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Recurring Payments */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Repeat className="h-3.5 w-3.5" />
                                {tr('title')}
                              </h3>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRecurringForm(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                                {tr('addRecurring')}
                              </button>
                            </div>
                            {loadingRecurring ? (
                              <div className="flex justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            ) : (allRecurringPayments[contact.id] || []).length === 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContact(contact);
                                  setShowRecurringForm(true);
                                }}
                                className="w-full rounded-lg p-3 text-center bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/10 transition-colors group"
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                    {tr('noRecurringPayments')} - {tr('addRecurring')}
                                  </span>
                                </div>
                              </button>
                            ) : (
                              <div className="space-y-4">
                                {(allRecurringPayments[contact.id] || []).map((recurring) => (
                                  <div key={recurring.id} className="space-y-2">
                                    {/* Recurring Payment Card */}
                                    <div
                                      className={cn(
                                        'rounded-lg p-3 bg-white/[0.04] border border-white/[0.06]',
                                        recurring.status === 'paused' && 'opacity-60'
                                      )}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="font-bold text-sm">
                                            {recurring.amountSat.toLocaleString()} sats
                                          </span>
                                          <span
                                            className={cn(
                                              'ml-2 text-[10px] px-1.5 py-0.5 rounded-full',
                                              recurring.status === 'active' &&
                                                'bg-success/10 text-success',
                                              recurring.status === 'paused' &&
                                                'bg-yellow-500/10 text-yellow-500'
                                            )}
                                          >
                                            {tr(recurring.status)}
                                          </span>
                                          {recurring.connection && (
                                            <span
                                              className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400"
                                              title={`Node: ${recurring.connection.name}`}
                                            >
                                              {recurring.connection.isDocker ? '🐳' : '🌐'} {recurring.connection.name}
                                            </span>
                                          )}
                                          {recurring.lastError && (
                                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                                              Error
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingRecurring(recurring);
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                            title={tc('edit')}
                                          >
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleRecurring(recurring);
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                            title={
                                              recurring.status === 'active'
                                                ? tr('pause')
                                                : tr('resume')
                                            }
                                          >
                                            {recurring.status === 'active' ? (
                                              <Pause className="h-3.5 w-3.5" />
                                            ) : (
                                              <Play className="h-3.5 w-3.5" />
                                            )}
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteRecurring(recurring.id);
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                                          >
                                            <XCircle className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-muted-foreground">
                                          {getFrequencyLabel(recurring)}
                                        </p>
                                        {recurring.status === 'active' &&
                                          countdowns[recurring.id] && (
                                            <span className="flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                              <Timer className="h-2.5 w-2.5" />
                                              {countdowns[recurring.id]}
                                            </span>
                                          )}
                                      </div>

                                      {/* Show error if any */}
                                      {recurring.lastError && (
                                        <p
                                          className="text-[10px] text-destructive mt-1 truncate"
                                          title={recurring.lastError}
                                        >
                                          {recurring.lastError}
                                        </p>
                                      )}
                                    </div>

                                    {/* Payment History for this recurring payment */}
                                    {recurring.paymentCount > 0 && (
                                      <div className="mt-2">
                                        {/* Header - styled as a button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (recurringExecutions[recurring.id]) {
                                              toggleHistoryVisibility(recurring.id);
                                            } else {
                                              fetchRecurringExecutions(recurring.id);
                                            }
                                          }}
                                          className="w-full rounded-lg p-2.5 flex items-center justify-between bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors group"
                                        >
                                          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                            {t('paymentHistory')} ({recurring.paymentCount})
                                          </span>
                                          {loadingExecutions === recurring.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                          ) : expandedHistories[recurring.id] ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                          ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                          )}
                                        </button>

                                        {expandedHistories[recurring.id] &&
                                          recurringExecutions[recurring.id] && (
                                            <div className="mt-1.5 space-y-1 pl-3 border-l-2 border-white/[0.06]">
                                              {(recurringExecutions[recurring.id] || []).map(
                                                (exec) => (
                                                  <button
                                                    key={exec.id}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (
                                                        exec.status === 'success' &&
                                                        exec.paymentId
                                                      ) {
                                                        handleSelectExecution(exec);
                                                      }
                                                    }}
                                                    disabled={
                                                      exec.status !== 'success' || !exec.paymentId
                                                    }
                                                    className={cn(
                                                      'w-full rounded-lg p-2.5 flex items-center gap-2 bg-white/[0.03] border border-white/[0.04] text-left',
                                                      exec.status === 'success' && exec.paymentId
                                                        ? 'hover:bg-white/[0.06] cursor-pointer transition-colors'
                                                        : 'opacity-70 cursor-default'
                                                    )}
                                                  >
                                                    {exec.status === 'success' ? (
                                                      <ArrowUpFromLine className="h-3.5 w-3.5 text-primary shrink-0" />
                                                    ) : (
                                                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                                    )}
                                                    <span className="text-xs flex-1 truncate">
                                                      {exec.status === 'success'
                                                        ? `${exec.amountSat.toLocaleString()} sats`
                                                        : exec.errorMessage || 'Failed'}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                      {new Date(exec.executedAt).toLocaleString(
                                                        undefined,
                                                        {
                                                          month: 'short',
                                                          day: 'numeric',
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                          second: '2-digit',
                                                        }
                                                      )}
                                                    </span>
                                                  </button>
                                                )
                                              )}
                                              {/* Load more button for this recurring payment */}
                                              {hasMoreExecutions[recurring.id] && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    fetchRecurringExecutions(recurring.id, true);
                                                  }}
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
                                                      {t('loadMore')}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {t('addContact')}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <ContactForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              loading={saving}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              {t('editContact')}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {editingContact && (
              <ContactForm
                contact={editingContact}
                onSubmit={handleUpdate}
                onCancel={() => setEditingContact(null)}
                loading={saving}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Pay Dialog */}
      <Dialog
        open={showQuickPayDialog}
        onOpenChange={(open) => {
          setShowQuickPayDialog(open);
          if (!open) {
            setQuickPayAmount('');
            setQuickPayNote('');
            setSelectedPaymentAddress(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              {t('quickPay')}
            </DialogTitle>
            {selectedContact && (
              <p className="text-sm text-muted-foreground">
                {t('payingTo', { name: selectedContact.name })}
              </p>
            )}
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {/* Amount Input */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                {t('amount')} (sats)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-lg glass-card bg-white/[0.02] text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  sats
                </span>
              </div>
            </div>

            {/* Note Input */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                {t('noteOptional')}
              </label>
              <input
                type="text"
                value={quickPayNote}
                onChange={(e) => setQuickPayNote(e.target.value)}
                placeholder={t('addNote')}
                className="w-full px-4 py-2 rounded-lg glass-card bg-white/[0.02] focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Payment Method Info */}
            {selectedContact &&
              (selectedPaymentAddress || selectedContact.addresses.length > 0) && (
                <div className="glass-card rounded-lg p-3 bg-white/[0.02]">
                  <p className="text-xs text-muted-foreground mb-1">{t('usingPaymentMethod')}</p>
                  {(() => {
                    const addr =
                      selectedPaymentAddress ||
                      selectedContact.addresses.find((a) => a.isPrimary) ||
                      selectedContact.addresses[0];
                    if (!addr) return null;
                    const Icon = getTypeIcon(addr.type);
                    return (
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium shrink-0">
                          {addr.type === 'lightning_address'
                            ? 'LN'
                            : addr.type === 'node_id'
                              ? 'Node'
                              : 'BOLT12'}
                          :
                        </span>
                        <p className="text-sm font-mono truncate">
                          {addr.address.length > 30
                            ? `${addr.address.slice(0, 15)}...${addr.address.slice(-10)}`
                            : addr.address}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowQuickPayDialog(false);
                  setQuickPayAmount('');
                  setQuickPayNote('');
                  setSelectedPaymentAddress(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg glass-card hover:bg-white/10 transition-colors text-sm font-medium"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleQuickPay}
                disabled={quickPayLoading || !quickPayAmount || parseInt(quickPayAmount) <= 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {quickPayLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    {t('sendPayment')}
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Recurring Payment Dialog */}
      <Dialog open={showRecurringForm} onOpenChange={setShowRecurringForm}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              {tr('addRecurring')}
            </DialogTitle>
            {selectedContact && (
              <p className="text-sm text-muted-foreground">
                {tr('schedulingFor', { contact: selectedContact.name })}
              </p>
            )}
          </DialogHeader>
          <div className="mt-4">
            {selectedContact && (
              <RecurringPaymentForm
                contact={selectedContact}
                categories={categories}
                onSubmit={handleCreateRecurring}
                onCancel={() => setShowRecurringForm(false)}
                onManageCategories={() => setShowCategoryManager(true)}
                loading={saving}
              />
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
              {tr('editRecurring')}
            </DialogTitle>
            {editingRecurring?.contact && (
              <p className="text-sm text-muted-foreground">
                {tr('editingFor', { contact: editingRecurring.contact.name })}
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
          }
        }}
        payment={fullPaymentDetails}
        metadata={selectedPaymentDetail}
        categories={categories}
        contact={selectedPaymentDetail?.contact}
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
          // Refresh categories
          getCategories().then(setCategories).catch(console.error);
        }}
      />
    </>
  );
}
