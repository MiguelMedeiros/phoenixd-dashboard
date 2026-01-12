'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Calendar, Clock, Repeat, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type Contact,
  type ContactAddress,
  type RecurringPaymentFrequency,
  type PaymentCategory,
  type RecurringPayment,
} from '@/lib/api';

interface RecurringPaymentFormProps {
  contact: Contact;
  categories?: PaymentCategory[];
  /** If provided, form is in edit mode */
  editingPayment?: RecurringPayment | null;
  onSubmit: (data: {
    contactId: string;
    addressId: string;
    amountSat: number;
    frequency: RecurringPaymentFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    note?: string;
    categoryIds?: string[];
  }) => Promise<void>;
  onCancel: () => void;
  onManageCategories?: () => void;
  loading?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function RecurringPaymentForm({
  contact,
  categories = [],
  editingPayment,
  onSubmit,
  onCancel,
  onManageCategories,
  loading,
}: RecurringPaymentFormProps) {
  const t = useTranslations('recurringPayments');
  const tc = useTranslations('common');
  const tcat = useTranslations('categories');

  const isEditMode = !!editingPayment;

  // Filter addresses that support recurring payments (lightning_address or bolt12_offer)
  const payableAddresses = contact.addresses.filter(
    (a) => a.type === 'lightning_address' || a.type === 'bolt12_offer'
  );

  // Initialize with edit values if in edit mode
  const [addressId, setAddressId] = useState<string>(
    editingPayment?.addressId ||
      payableAddresses.find((a) => a.isPrimary)?.id ||
      payableAddresses[0]?.id ||
      ''
  );
  const [amountSat, setAmountSat] = useState<string>(editingPayment?.amountSat?.toString() || '');
  const [frequency, setFrequency] = useState<RecurringPaymentFrequency>(
    editingPayment?.frequency || 'monthly'
  );
  const [dayOfWeek, setDayOfWeek] = useState<number>(editingPayment?.dayOfWeek ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(editingPayment?.dayOfMonth ?? 1);
  const [timeOfDay, setTimeOfDay] = useState<string>(editingPayment?.timeOfDay || '09:00');
  const [note, setNote] = useState<string>(editingPayment?.note || '');
  const [categoryIds, setCategoryIds] = useState<string[]>(
    editingPayment?.categoryId ? [editingPayment.categoryId] : []
  );

  // Reset form when editingPayment changes
  useEffect(() => {
    if (editingPayment) {
      setAddressId(editingPayment.addressId);
      setAmountSat(editingPayment.amountSat.toString());
      setFrequency(editingPayment.frequency);
      setDayOfWeek(editingPayment.dayOfWeek ?? 1);
      setDayOfMonth(editingPayment.dayOfMonth ?? 1);
      setTimeOfDay(editingPayment.timeOfDay || '09:00');
      setNote(editingPayment.note || '');
      setCategoryIds(editingPayment.categoryId ? [editingPayment.categoryId] : []);
    }
  }, [editingPayment]);

  const toggleCategory = (catId: string) => {
    setCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseInt(amountSat);
    if (!amount || amount <= 0) return;
    if (!addressId) return;

    await onSubmit({
      contactId: contact.id,
      addressId,
      amountSat: amount,
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      timeOfDay,
      note: note || undefined,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    });
  };

  const getAddressLabel = (addr: ContactAddress) => {
    const typeLabel = addr.type === 'lightning_address' ? 'LN Address' : 'BOLT12';
    return `${typeLabel}: ${addr.address.length > 30 ? addr.address.slice(0, 30) + '...' : addr.address}`;
  };

  if (payableAddresses.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{t('noPayableAddresses')}</p>
        <p className="text-sm text-muted-foreground mt-2">{t('addLnAddressOrBolt12')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Address Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('paymentAddress')}</label>
        <select
          value={addressId}
          onChange={(e) => setAddressId(e.target.value)}
          className="glass-input w-full px-4 py-3 rounded-xl"
          required
        >
          {payableAddresses.map((addr) => (
            <option key={addr.id} value={addr.id}>
              {getAddressLabel(addr)}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('amount')} (sats)</label>
        <input
          type="number"
          value={amountSat}
          onChange={(e) => setAmountSat(e.target.value)}
          placeholder="1000"
          min="1"
          className="glass-input w-full px-4 py-3 rounded-xl"
          required
        />
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          {t('frequency')}
        </label>
        {/* Short intervals */}
        <div className="grid grid-cols-5 gap-1">
          {(
            [
              'every_minute',
              'every_5_minutes',
              'every_15_minutes',
              'every_30_minutes',
              'hourly',
            ] as RecurringPaymentFrequency[]
          ).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => setFrequency(freq)}
              className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                frequency === freq ? 'bg-primary text-white' : 'glass-card hover:bg-white/10'
              }`}
            >
              {t(freq)}
            </button>
          ))}
        </div>
        {/* Long intervals */}
        <div className="grid grid-cols-3 gap-2">
          {(['daily', 'weekly', 'monthly'] as RecurringPaymentFrequency[]).map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => setFrequency(freq)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                frequency === freq ? 'bg-primary text-white' : 'glass-card hover:bg-white/10'
              }`}
            >
              {t(freq)}
            </button>
          ))}
        </div>
      </div>

      {/* Day of Week (for weekly) */}
      {frequency === 'weekly' && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('dayOfWeek')}
          </label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
            className="glass-input w-full px-4 py-3 rounded-xl"
          >
            {DAYS_OF_WEEK.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Day of Month (for monthly) */}
      {frequency === 'monthly' && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('dayOfMonth')}
          </label>
          <select
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
            className="glass-input w-full px-4 py-3 rounded-xl"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Time of Day - only show for daily, weekly, monthly */}
      {['daily', 'weekly', 'monthly'].includes(frequency) && (
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('timeOfDay')} (UTC)
          </label>
          <input
            type="time"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            className="glass-input w-full px-4 py-3 rounded-xl"
          />
        </div>
      )}

      {/* Note */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t('note')} <span className="text-muted-foreground">({tc('optional')})</span>
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('notePlaceholder')}
          className="glass-input w-full px-4 py-3 rounded-xl"
        />
      </div>

      {/* Category - Multi-select */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {t('category')} <span className="text-muted-foreground">({tc('optional')})</span>
          </label>
          {onManageCategories && (
            <button
              type="button"
              onClick={onManageCategories}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {categories.length === 0 ? tcat('addCategory') : tcat('manage')}
            </button>
          )}
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tcat('noCategories')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const isSelected = categoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
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
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      {amountSat && parseInt(amountSat) > 0 && (
        <div className="glass-card rounded-xl p-4 bg-primary/5 border border-primary/20">
          <p className="text-sm text-muted-foreground">{t('summary')}</p>
          <p className="font-medium mt-1">
            {t('willPay', {
              amount: parseInt(amountSat).toLocaleString(),
              frequency: t(frequency),
              contact: contact.name,
            })}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl glass-card hover:bg-white/10 transition-colors font-medium"
        >
          {tc('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading || !amountSat || parseInt(amountSat) <= 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tc('loading')}
            </>
          ) : isEditMode ? (
            tc('save')
          ) : (
            t('createRecurring')
          )}
        </button>
      </div>
    </form>
  );
}
