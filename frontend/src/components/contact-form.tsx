'use client';

import { useState } from 'react';
import { Loader2, User, AtSign, Hash, Gift, Plus, Trash2, Star, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Contact, ContactType, CreateContactAddressInput } from '@/lib/api';

interface ContactFormProps {
  contact?: Contact;
  onSubmit: (data: {
    name: string;
    label?: string;
    avatarUrl?: string;
    addresses: CreateContactAddressInput[];
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const contactTypes: {
  value: ContactType;
  icon: typeof AtSign;
  labelKey: string;
  shortLabel: string;
}[] = [
  { value: 'lightning_address', icon: AtSign, labelKey: 'lightningAddress', shortLabel: 'LN' },
  { value: 'node_id', icon: Hash, labelKey: 'nodeId', shortLabel: 'Node' },
  { value: 'bolt12_offer', icon: Gift, labelKey: 'bolt12Offer', shortLabel: 'BOLT12' },
];

interface AddressEntry {
  id: string;
  address: string;
  type: ContactType;
  isPrimary: boolean;
}

export function ContactForm({ contact, onSubmit, onCancel, loading }: ContactFormProps) {
  const t = useTranslations('contacts');
  const tc = useTranslations('common');

  const [name, setName] = useState(contact?.name || '');
  const [label, setLabel] = useState(contact?.label || '');

  // Initialize addresses from existing contact or empty
  const [addresses, setAddresses] = useState<AddressEntry[]>(() => {
    if (contact?.addresses && contact.addresses.length > 0) {
      return contact.addresses.map((addr) => ({
        id: addr.id,
        address: addr.address,
        type: addr.type as ContactType,
        isPrimary: addr.isPrimary,
      }));
    }
    // Start with one empty address
    return [
      {
        id: crypto.randomUUID(),
        address: '',
        type: 'lightning_address',
        isPrimary: true,
      },
    ];
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty addresses and prepare data
    const validAddresses = addresses
      .filter((addr) => addr.address.trim())
      .map((addr) => ({
        id: addr.id,
        address: addr.address.trim(),
        type: addr.type,
        isPrimary: addr.isPrimary,
      }));

    if (validAddresses.length === 0) {
      return; // At least one address required
    }

    // Ensure at least one primary
    if (!validAddresses.some((a) => a.isPrimary)) {
      validAddresses[0].isPrimary = true;
    }

    await onSubmit({
      name: name.trim(),
      label: label.trim() || undefined,
      addresses: validAddresses,
    });
  };

  const addAddress = () => {
    setAddresses((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        address: '',
        type: 'lightning_address',
        isPrimary: false,
      },
    ]);
  };

  const removeAddress = (id: string) => {
    setAddresses((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      // If we removed the primary, make the first one primary
      if (filtered.length > 0 && !filtered.some((a) => a.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const updateAddress = (id: string, updates: Partial<AddressEntry>) => {
    setAddresses((prev) =>
      prev.map((addr) => {
        if (addr.id === id) {
          return { ...addr, ...updates };
        }
        // If setting this as primary, unset others
        if (updates.isPrimary && addr.id !== id) {
          return { ...addr, isPrimary: false };
        }
        return addr;
      })
    );
  };

  const getPlaceholder = (type: ContactType) => {
    switch (type) {
      case 'lightning_address':
        return 'user@domain.com';
      case 'node_id':
        return '02a1b2c3...';
      case 'bolt12_offer':
        return 'lno1...';
    }
  };

  const getTypeIcon = (type: ContactType) => {
    const found = contactTypes.find((t) => t.value === type);
    return found?.icon || AtSign;
  };

  const hasValidAddresses = addresses.some((a) => a.address.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('name')} *
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-3"
            required
          />
        </div>
      </div>

      {/* Label for the contact */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('contactLabel')}
        </label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('contactLabelPlaceholder')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-3"
          />
        </div>
      </div>

      {/* Addresses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('paymentMethods')} *
          </label>
          <button
            type="button"
            onClick={addAddress}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addMethod')}
          </button>
        </div>

        <div className="space-y-3">
          {addresses.map((addr, index) => {
            const TypeIcon = getTypeIcon(addr.type);
            return (
              <div
                key={addr.id}
                className={cn(
                  'glass-card rounded-xl p-4 space-y-3 relative',
                  addr.isPrimary && 'ring-1 ring-primary/30'
                )}
              >
                {/* Header with type selector and actions */}
                <div className="flex items-center justify-between gap-2">
                  {/* Type Selector */}
                  <div className="flex gap-1">
                    {contactTypes.map(({ value, icon: Icon, labelKey, shortLabel }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateAddress(addr.id, { type: value })}
                        title={t(labelKey)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all text-[11px] font-medium whitespace-nowrap',
                          addr.type === value
                            ? 'bg-primary/20 text-primary'
                            : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{shortLabel}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Primary Toggle */}
                    <button
                      type="button"
                      onClick={() => updateAddress(addr.id, { isPrimary: true })}
                      className={cn(
                        'p-2 rounded-lg transition-all',
                        addr.isPrimary
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                      )}
                      title={t('primary')}
                    >
                      <Star className={cn('h-4 w-4', addr.isPrimary && 'fill-current')} />
                    </button>

                    {/* Delete */}
                    {addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAddress(addr.id)}
                        className="p-2 rounded-lg bg-white/5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Address Input */}
                <div className="relative">
                  <TypeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={getPlaceholder(addr.type)}
                    value={addr.address}
                    onChange={(e) => updateAddress(addr.id, { address: e.target.value })}
                    className="glass-input w-full pl-10 pr-4 py-2.5 font-mono text-sm"
                    required={index === 0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 glass-card px-4 py-3 rounded-xl font-medium hover:bg-white/10 transition-colors"
        >
          {tc('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading || !name.trim() || !hasValidAddresses}
          className="flex-1 btn-gradient flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : tc('save')}
        </button>
      </div>
    </form>
  );
}
