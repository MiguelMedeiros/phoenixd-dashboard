'use client';

import { ArrowDownToLine, ArrowUpFromLine, Clock, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CategoryBadge } from '@/components/category-badge';
import type { IncomingPayment, OutgoingPayment, PaymentMetadata } from '@/lib/api';

export type Payment = IncomingPayment | OutgoingPayment;

export interface PaymentListItemProps {
  payment: Payment;
  metadata?: PaymentMetadata | null;
  formatValue: (value: number) => string;
  onClick?: () => void;
  variant?: 'default' | 'compact';
  showCategories?: boolean;
  showFees?: boolean;
  showArrow?: boolean;
  animationDelay?: number;
}

// Format date for display
function formatShortDate(timestamp: number, t: ReturnType<typeof useTranslations>): string {
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
}

export function PaymentListItem({
  payment,
  metadata,
  formatValue,
  onClick,
  variant = 'default',
  showCategories = true,
  showFees = true,
  showArrow = true,
  animationDelay = 0,
}: PaymentListItemProps) {
  const t = useTranslations('payments');
  const tc = useTranslations('common');

  const isIncoming = 'receivedSat' in payment;
  const amount = isIncoming
    ? (payment as IncomingPayment).receivedSat
    : (payment as OutgoingPayment).sent;

  const isCompact = variant === 'compact';

  // Get description to display
  const description = isIncoming
    ? metadata?.note || (payment as IncomingPayment).description
    : metadata?.note;

  const dateDisplay = formatShortDate(payment.completedAt || payment.createdAt, t);

  if (isCompact) {
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left',
          onClick ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
            isIncoming ? 'bg-success/10' : 'bg-primary/10'
          )}
        >
          {isIncoming ? (
            <ArrowDownToLine className="h-4 w-4 text-success" />
          ) : (
            <ArrowUpFromLine className="h-4 w-4 text-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{isIncoming ? t('received') : t('sent')}</p>
          <p className="text-xs text-muted-foreground truncate">
            {payment.completedAt
              ? new Date(payment.completedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : tc('pending')}
            {description && ` • ${description}`}
          </p>
        </div>

        {/* Amount */}
        <p
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isIncoming ? 'text-success' : 'text-foreground'
          )}
        >
          {isIncoming ? '+' : '-'}
          {formatValue(amount)}
        </p>

        {/* Arrow */}
        {showArrow && onClick && (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
    );
  }

  // Default variant - full styling from /payments page
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full glass-card rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center gap-3 md:gap-4 transition-all text-left group',
        onClick ? 'hover:bg-white/[0.08] cursor-pointer' : 'cursor-default'
      )}
      style={animationDelay > 0 ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-10 w-10 md:h-14 md:w-14 items-center justify-center rounded-xl md:rounded-2xl shrink-0 transition-transform',
          onClick && 'group-hover:scale-110',
          isIncoming
            ? payment.isPaid
              ? 'bg-gradient-to-br from-success/20 to-emerald-600/20'
              : 'bg-yellow-500/10'
            : payment.isPaid
              ? 'bg-gradient-to-br from-primary/20 to-orange-600/20'
              : 'bg-yellow-500/10'
        )}
      >
        {isIncoming ? (
          <ArrowDownToLine
            className={cn(
              'h-4 w-4 md:h-6 md:w-6',
              payment.isPaid ? 'text-success' : 'text-yellow-500'
            )}
          />
        ) : (
          <ArrowUpFromLine
            className={cn(
              'h-4 w-4 md:h-6 md:w-6',
              payment.isPaid ? 'text-primary' : 'text-yellow-500'
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 md:gap-3 mb-0.5 md:mb-1 flex-wrap">
          <span
            className={cn(
              'font-bold text-sm md:text-lg',
              isIncoming ? 'text-success' : 'text-foreground'
            )}
          >
            {isIncoming ? '+' : '-'}
            {formatValue(amount)}
          </span>
          <span
            className={cn(
              'text-[10px] md:text-xs px-2 md:px-2.5 py-0.5 md:py-1 rounded-full font-medium',
              payment.isPaid ? 'bg-success/10 text-success' : 'bg-yellow-500/10 text-yellow-500'
            )}
          >
            {payment.isPaid ? (isIncoming ? t('received') : t('sent')) : tc('pending')}
          </span>
          {/* Fees for outgoing payments */}
          {showFees && !isIncoming && (payment as OutgoingPayment).fees > 0 && (
            <span className="text-[10px] md:text-xs text-muted-foreground hidden sm:inline">
              {t('fee')}: {formatValue(Math.floor((payment as OutgoingPayment).fees / 1000))}
            </span>
          )}
          {/* Category badges */}
          {showCategories &&
            metadata?.categories?.map((cat) => (
              <CategoryBadge key={cat.id} category={cat} size="sm" />
            ))}
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
          <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" />
          <span className="truncate">
            {dateDisplay}
            {description && ` • ${description}`}
          </span>
        </div>
      </div>

      {/* Arrow */}
      {showArrow && onClick && (
        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      )}
    </button>
  );
}
