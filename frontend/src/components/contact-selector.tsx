'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, AtSign, Hash, Gift, X, Plus, ChevronLeft, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getContacts, type Contact, type ContactAddress, type ContactType } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ContactSelectorProps {
  value?: { contact: Contact; address: ContactAddress } | null;
  onChange: (selection: { contact: Contact; address: ContactAddress } | null) => void;
  onAddNew?: () => void;
  placeholder?: string;
  filterType?: ContactType | ContactType[]; // Only show contacts with these address types
}

export function ContactSelector({
  value,
  onChange,
  onAddNew,
  placeholder,
  filterType,
}: ContactSelectorProps) {
  const t = useTranslations('contacts');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingMethodFor, setSelectingMethodFor] = useState<Contact | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all contacts on mount
  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      try {
        const data = await getContacts();
        setAllContacts(data);
      } catch (error) {
        console.error('Failed to load contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  // Filter contacts locally for instant search
  const filteredContacts = useMemo(() => {
    let result = allContacts;

    // Filter by search term
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.addresses.some((a) => a.address.toLowerCase().includes(lower))
      );
    }

    // Filter by address type if specified
    if (filterType) {
      const types = Array.isArray(filterType) ? filterType : [filterType];
      result = result.filter((c) => c.addresses.some((a) => types.includes(a.type as ContactType)));
    }

    return result;
  }, [allContacts, search, filterType]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectingMethodFor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const getTypeLabel = (type: string) => {
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

  const handleSelectContact = (contact: Contact) => {
    // Filter addresses by type if filterType is specified
    const availableAddresses = filterType
      ? contact.addresses.filter((a) => {
          const types = Array.isArray(filterType) ? filterType : [filterType];
          return types.includes(a.type as ContactType);
        })
      : contact.addresses;

    if (availableAddresses.length === 1) {
      // Only one address, select it directly
      onChange({ contact, address: availableAddresses[0] });
      setOpen(false);
      setSearch('');
    } else if (availableAddresses.length > 1) {
      // Multiple addresses, show method selector
      setSelectingMethodFor(contact);
    }
  };

  const handleSelectAddress = (contact: Contact, address: ContactAddress) => {
    onChange({ contact, address });
    setOpen(false);
    setSearch('');
    setSelectingMethodFor(null);
  };

  // If value is selected, show it
  if (value) {
    const Icon = getTypeIcon(value.address.type);
    return (
      <div className="glass-card flex items-center gap-3 px-4 py-3 rounded-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{value.contact.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Icon className="h-3 w-3" />
            <span className="truncate">{value.address.address}</span>
          </p>
        </div>
        <button
          onClick={() => onChange(null)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors rounded-xl border border-white/10 bg-[#1a1a1a]',
          open && 'ring-2 ring-primary'
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={placeholder || t('selectContact')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 overflow-hidden z-50 max-h-80 overflow-y-auto bg-[#1a1a1a] shadow-xl">
          {/* Method Selection View */}
          {selectingMethodFor ? (
            <>
              <button
                onClick={() => setSelectingMethodFor(null)}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-white/5 transition-colors border-b border-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
                {tc('back')}
              </button>
              <div className="p-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectingMethodFor.name}</p>
                    <p className="text-xs text-muted-foreground">{t('selectMethod')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(filterType
                    ? selectingMethodFor.addresses.filter((a) => {
                        const types = Array.isArray(filterType) ? filterType : [filterType];
                        return types.includes(a.type as ContactType);
                      })
                    : selectingMethodFor.addresses
                  ).map((addr) => {
                    const Icon = getTypeIcon(addr.type);
                    return (
                      <button
                        key={addr.id}
                        onClick={() => handleSelectAddress(selectingMethodFor, addr)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg',
                            addr.type === 'lightning_address' && 'bg-primary/10',
                            addr.type === 'node_id' && 'bg-accent/10',
                            addr.type === 'bolt12_offer' && 'bg-success/10'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              addr.type === 'lightning_address' && 'text-primary',
                              addr.type === 'node_id' && 'text-accent',
                              addr.type === 'bolt12_offer' && 'text-success'
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {getTypeLabel(addr.type)}
                            </span>
                            {addr.isPrimary && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <p className="text-sm font-mono truncate">{addr.address}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Contact List View */
            <>
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">{tc('loading')}</div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {t('noContacts')}
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  // Get addresses that match filter
                  const availableAddresses = filterType
                    ? contact.addresses.filter((a) => {
                        const types = Array.isArray(filterType) ? filterType : [filterType];
                        return types.includes(a.type as ContactType);
                      })
                    : contact.addresses;

                  return (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{contact.name}</p>
                        {/* Show address type badges */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {availableAddresses.map((addr) => {
                            const Icon = getTypeIcon(addr.type);
                            return (
                              <div
                                key={addr.id}
                                className={cn(
                                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                                  addr.type === 'lightning_address' && 'bg-primary/10 text-primary',
                                  addr.type === 'node_id' && 'bg-accent/10 text-accent',
                                  addr.type === 'bolt12_offer' && 'bg-success/10 text-success'
                                )}
                                title={addr.address}
                              >
                                <Icon className="h-2.5 w-2.5" />
                                {addr.isPrimary && <Star className="h-2 w-2 fill-current" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {availableAddresses.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {availableAddresses.length} {t('methods')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}

              {onAddNew && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onAddNew();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 border-t border-white/10 hover:bg-white/5 transition-colors text-primary"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('addContact')}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
