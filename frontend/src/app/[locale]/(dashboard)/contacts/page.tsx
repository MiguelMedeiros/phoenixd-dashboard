'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  Star,
  Zap,
  Send,
  Repeat,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContactForm } from '@/components/contact-form';
import { useToast } from '@/hooks/use-toast';
import {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  payOffer,
  payLnAddress,
  createRecurringPayment,
  getCategories,
  type Contact,
  type ContactAddress,
  type CreateContactAddressInput,
  type PaymentCategory,
  type RecurringPaymentFrequency,
} from '@/lib/api';
import { RecurringPaymentForm } from '@/components/recurring-payment-form';
import { StatCard, StatCardGrid } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';

export default function ContactsPage() {
  const t = useTranslations('contacts');
  const tc = useTranslations('common');
  const { toast } = useToast();

  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Quick pay dialog state
  const [showQuickPayDialog, setShowQuickPayDialog] = useState(false);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayNote, setQuickPayNote] = useState('');
  const [quickPayLoading, setQuickPayLoading] = useState(false);
  const [selectedPaymentAddress, setSelectedPaymentAddress] = useState<ContactAddress | null>(null);

  // Label filter state
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string | null>(null);

  // Recurring payment dialog state
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [categories, setCategories] = useState<PaymentCategory[]>([]);

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

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing contacts data...');
      setTimeout(() => {
        fetchContacts();
      }, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchContacts]);

  // Filter contacts locally for instant search and label filter
  const contacts = useMemo(() => {
    let filtered = allContacts;

    if (selectedLabelFilter) {
      filtered = filtered.filter((c) => c.label === selectedLabelFilter);
    }

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

  // Fetch categories when recurring dialog opens
  useEffect(() => {
    if (showRecurringDialog) {
      getCategories()
        .then(setCategories)
        .catch((error) => {
          console.error('Failed to load categories:', error);
        });
    }
  }, [showRecurringDialog]);

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
    setRecurringLoading(true);
    try {
      await createRecurringPayment({
        contactId: data.contactId,
        addressId: data.addressId,
        amountSat: data.amountSat,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        timeOfDay: data.timeOfDay,
        note: data.note,
        categoryId: data.categoryIds?.[0],
      });

      toast({
        title: tc('success'),
        description: t('recurringCreated'),
      });
      setShowRecurringDialog(false);
      setSelectedPaymentAddress(null);
    } catch (error) {
      console.error('Failed to create recurring payment:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setRecurringLoading(false);
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
      await fetchContacts();
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

  const sortAddresses = (addresses: ContactAddress[]) => {
    const typeOrder: Record<string, number> = {
      lightning_address: 1,
      bolt12_offer: 2,
      node_id: 3,
    };
    return [...addresses].sort((a, b) => {
      if (a.type === b.type) {
        return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0);
      }
      return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
    });
  };

  const totalContacts = allContacts.length;

  const stats = useMemo(() => {
    let lnAddresses = 0;
    let bolt12Offers = 0;
    let totalPayments = 0;

    allContacts.forEach((contact) => {
      contact.addresses.forEach((addr) => {
        if (addr.type === 'lightning_address') lnAddresses++;
        else if (addr.type === 'bolt12_offer') bolt12Offers++;
      });
      if (contact._count?.payments) {
        totalPayments += contact._count.payments;
      }
    });

    return { lnAddresses, bolt12Offers, totalPayments };
  }, [allContacts]);

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
          <StatCardGrid columns={3}>
            <StatCard
              label="LN Address"
              value={stats.lnAddresses}
              icon={AtSign}
              variant="primary"
            />
            <StatCard label="BOLT12" value={stats.bolt12Offers} icon={Gift} variant="success" />
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
                          setSelectedContact(contact);
                        }
                      }}
                      className="w-full px-3 py-2.5 flex items-center gap-3 text-left group hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Avatar */}
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

                    {/* Accordion Content - Payment Methods only */}
                    {isExpanded && (
                      <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="px-4 pb-4 pt-2 border-t border-white/[0.06]">
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
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPaymentAddress(addr);
                                            setShowRecurringDialog(true);
                                          }}
                                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs font-medium"
                                          title={t('createRecurring')}
                                        >
                                          <Repeat className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPaymentAddress(addr);
                                            setShowQuickPayDialog(true);
                                          }}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                                        >
                                          <Send className="h-3 w-3" />
                                          {t('pay')}
                                        </button>
                                      </div>
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

      {/* Recurring Payment Dialog */}
      <Dialog
        open={showRecurringDialog}
        onOpenChange={(open) => {
          setShowRecurringDialog(open);
          if (!open) {
            setSelectedPaymentAddress(null);
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-accent" />
              {t('createRecurring')}
            </DialogTitle>
            {selectedContact && (
              <p className="text-sm text-muted-foreground">
                {t('recurringTo', { name: selectedContact.name })}
              </p>
            )}
          </DialogHeader>
          <div className="mt-4">
            {selectedContact && (
              <RecurringPaymentForm
                contact={{
                  ...selectedContact,
                  addresses: selectedPaymentAddress
                    ? selectedContact.addresses.map((a) => ({
                        ...a,
                        isPrimary: a.id === selectedPaymentAddress.id,
                      }))
                    : selectedContact.addresses,
                }}
                categories={categories}
                onSubmit={handleCreateRecurring}
                onCancel={() => {
                  setShowRecurringDialog(false);
                  setSelectedPaymentAddress(null);
                }}
                loading={recurringLoading}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
