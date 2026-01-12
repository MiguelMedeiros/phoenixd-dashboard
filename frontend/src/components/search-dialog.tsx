'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Home,
  Layers,
  Wrench,
  Link2,
  X,
  FileCode,
  Zap,
  Settings,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useCurrencyContext } from '@/components/currency-provider';
import {
  getIncomingPayments,
  getOutgoingPayments,
  type IncomingPayment,
  type OutgoingPayment,
} from '@/lib/api';
import { useTranslations } from 'next-intl';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SearchResult = {
  type: 'page' | 'payment';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  data?: IncomingPayment | OutgoingPayment;
};

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const t = useTranslations('search');
  const { formatValue } = useCurrencyContext();

  const pages: SearchResult[] = useMemo(
    () => [
      {
        type: 'page',
        title: t('overviewTitle'),
        subtitle: t('overviewSubtitle'),
        icon: <Home className="h-4 w-4" />,
        href: '/',
      },
      {
        type: 'page',
        title: t('contactsTitle'),
        subtitle: t('contactsSubtitle'),
        icon: <Users className="h-4 w-4" />,
        href: '/contacts',
      },
      {
        type: 'page',
        title: t('receiveTitle'),
        subtitle: t('receiveSubtitle'),
        icon: <ArrowDownToLine className="h-4 w-4" />,
        href: '/receive',
      },
      {
        type: 'page',
        title: t('sendTitle'),
        subtitle: t('sendSubtitle'),
        icon: <ArrowUpFromLine className="h-4 w-4" />,
        href: '/send',
      },
      {
        type: 'page',
        title: t('paymentsTitle'),
        subtitle: t('paymentsSubtitle'),
        icon: <FileCode className="h-4 w-4" />,
        href: '/payments',
      },
      {
        type: 'page',
        title: t('channelsTitle'),
        subtitle: t('channelsSubtitle'),
        icon: <Layers className="h-4 w-4" />,
        href: '/channels',
      },
      {
        type: 'page',
        title: t('toolsTitle'),
        subtitle: t('toolsSubtitle'),
        icon: <Wrench className="h-4 w-4" />,
        href: '/tools',
      },
      {
        type: 'page',
        title: t('lnurlTitle'),
        subtitle: t('lnurlSubtitle'),
        icon: <Link2 className="h-4 w-4" />,
        href: '/lnurl',
      },
      {
        type: 'page',
        title: t('settingsTitle'),
        subtitle: t('settingsSubtitle'),
        icon: <Settings className="h-4 w-4" />,
        href: '/settings',
      },
    ],
    [t]
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>(pages);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [payments, setPayments] = useState<(IncomingPayment | OutgoingPayment)[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch payments when dialog opens
  useEffect(() => {
    if (open && payments.length === 0) {
      setLoading(true);
      Promise.all([getIncomingPayments({ limit: 20 }), getOutgoingPayments({ limit: 20 })])
        .then(([incoming, outgoing]) => {
          setPayments([...(incoming || []), ...(outgoing || [])]);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, payments.length]);

  // Filter results based on query
  useEffect(() => {
    const q = query.toLowerCase().trim();

    if (!q) {
      setResults(pages);
      setSelectedIndex(0);
      return;
    }

    const filteredPages = pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.subtitle?.toLowerCase().includes(q)
    );

    const filteredPayments: SearchResult[] = payments
      .filter((p) => {
        const searchStr = [
          'paymentHash' in p ? p.paymentHash : '',
          'paymentId' in p ? p.paymentId : '',
          'description' in p ? p.description : '',
        ]
          .join(' ')
          .toLowerCase();
        return searchStr.includes(q);
      })
      .slice(0, 5)
      .map((p) => {
        const isIncoming = 'receivedSat' in p;
        return {
          type: 'payment' as const,
          title: isIncoming
            ? `+${formatValue((p as IncomingPayment).receivedSat)}`
            : `-${formatValue((p as OutgoingPayment).sent)}`,
          subtitle:
            'description' in p && p.description
              ? p.description
              : 'paymentHash' in p
                ? `${p.paymentHash?.slice(0, 16)}...`
                : '',
          icon: isIncoming ? (
            <ArrowDownToLine className="h-4 w-4 text-success" />
          ) : (
            <ArrowUpFromLine className="h-4 w-4 text-primary" />
          ),
          href: '/payments',
          data: p,
        };
      });

    setResults([...filteredPages, ...filteredPayments]);
    setSelectedIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, payments, pages]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        const result = results[selectedIndex];
        if (result.href) {
          router.push(result.href);
          onOpenChange(false);
          setQuery('');
        }
      } else if (e.key === 'Escape') {
        onOpenChange(false);
        setQuery('');
      }
    },
    [results, selectedIndex, router, onOpenChange]
  );

  const handleSelect = (result: SearchResult) => {
    if (result.href) {
      router.push(result.href);
      onOpenChange(false);
      setQuery('');
    }
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden [&>button]:hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-black/[0.08] dark:border-white/[0.08] bg-black/5 dark:bg-white/5 px-2 font-mono text-xs text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Zap className="h-6 w-6 text-primary animate-pulse" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t('noResults')}</p>
            </div>
          ) : (
            <>
              {/* Pages Section */}
              {results.some((r) => r.type === 'page') && (
                <div className="px-2 mb-2">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('pages')}
                  </p>
                  {results
                    .filter((r) => r.type === 'page')
                    .map((result, _index) => {
                      const actualIndex = results.findIndex((r) => r === result);
                      return (
                        <button
                          key={result.title}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                            actualIndex === selectedIndex
                              ? 'bg-primary/10 text-foreground'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-lg',
                              actualIndex === selectedIndex
                                ? 'bg-primary/20'
                                : 'bg-black/5 dark:bg-white/5'
                            )}
                          >
                            {result.icon}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Payments Section */}
              {results.some((r) => r.type === 'payment') && (
                <div className="px-2">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t('payments')}
                  </p>
                  {results
                    .filter((r) => r.type === 'payment')
                    .map((result) => {
                      const actualIndex = results.findIndex((r) => r === result);
                      return (
                        <button
                          key={`payment-${actualIndex}`}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                            actualIndex === selectedIndex
                              ? 'bg-primary/10 text-foreground'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-9 w-9 items-center justify-center rounded-lg',
                              actualIndex === selectedIndex
                                ? 'bg-primary/20'
                                : 'bg-black/5 dark:bg-white/5'
                            )}
                          >
                            {result.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-black/[0.08] dark:border-white/[0.08] text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08]">
                ↓
              </kbd>
              {t('navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08]">
                ↵
              </kbd>
              {t('select')}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08]">
              ⌘
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08]">
              K
            </kbd>
            {t('toOpen')}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
