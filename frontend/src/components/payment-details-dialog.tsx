'use client';

import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  Receipt,
  Calendar,
  Hash,
  Key,
  FileText,
  Copy,
  Check,
  ExternalLink,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaymentNoteEditor } from '@/components/payment-note-editor';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import type {
  IncomingPayment,
  OutgoingPayment,
  PaymentMetadata,
  PaymentCategory,
  Contact,
} from '@/lib/api';

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

interface PaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: IncomingPayment | OutgoingPayment | null;
  metadata?: PaymentMetadata | null;
  categories: PaymentCategory[];
  contact?: Contact | null;
  onUpdateNote?: (note: string | null) => Promise<void>;
  onToggleCategory?: (categoryId: string) => Promise<void>;
  onManageCategories?: () => void;
  formatValue: (value: number) => string;
  chain?: string;
}

export function PaymentDetailsDialog({
  open,
  onOpenChange,
  payment,
  metadata,
  categories,
  contact,
  onUpdateNote,
  onToggleCategory,
  onManageCategories,
  formatValue,
  chain = 'mainnet',
}: PaymentDetailsDialogProps) {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const tcat = useTranslations('categories');
  const tt = useTranslations('toast');

  const { copiedField, copy: copyToClipboard } = useCopyToClipboard();

  if (!payment) return null;

  const isIncoming = 'receivedSat' in payment;

  // Helper functions
  const truncateHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getMempoolUrl = (chainName: string, txId: string) => {
    const baseUrl =
      chainName === 'testnet' ? 'https://mempool.space/testnet' : 'https://mempool.space';
    return `${baseUrl}/tx/${txId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                isIncoming
                  ? 'bg-gradient-to-br from-success/20 to-emerald-600/20'
                  : 'bg-gradient-to-br from-primary/20 to-orange-600/20'
              )}
            >
              {isIncoming ? (
                <ArrowDownToLine className="h-6 w-6 text-success" />
              ) : (
                <ArrowUpFromLine className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl">{t('paymentDetails')}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {isIncoming ? t('incomingPayment') : t('outgoingPayment')}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Amount */}
          <div className="text-center py-6 glass-card rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent">
            {isIncoming ? (
              <p className="text-4xl font-bold text-success">
                +{formatValue((payment as IncomingPayment).receivedSat)}
              </p>
            ) : (
              <p className="text-4xl font-bold">
                -{formatValue((payment as OutgoingPayment).sent)}
              </p>
            )}
            {'fees' in payment && (payment as OutgoingPayment).fees > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('fee')}: {formatValue(Math.floor((payment as OutgoingPayment).fees / 1000))}
              </p>
            )}
          </div>

          {/* Note & Category */}
          <div className="space-y-4">
            {/* Note Editor */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                {tc('note')}
              </label>
              {onUpdateNote ? (
                <PaymentNoteEditor note={metadata?.note} onSave={onUpdateNote} />
              ) : (
                <div className="glass-card rounded-lg p-3 bg-white/[0.02]">
                  <p className="text-sm">
                    {metadata?.note || (
                      <span className="text-muted-foreground">{tc('noNote')}</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Category Selector - Multi-select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {tc('categories')}
                </label>
                {onManageCategories && (
                  <button
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
                    const isSelected = metadata?.categories?.some((c) => c.id === cat.id) || false;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => onToggleCategory?.(cat.id)}
                        disabled={!onToggleCategory}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-offset-background'
                            : 'opacity-60 hover:opacity-100',
                          !onToggleCategory && 'cursor-default'
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
                    payment.isPaid
                      ? 'bg-success/10 text-success'
                      : 'bg-yellow-500/10 text-yellow-500'
                  )}
                >
                  {payment.isPaid ? (isIncoming ? t('received') : t('sent')) : tc('pending')}
                </span>
              }
            />

            {/* Type */}
            <DetailRow
              icon={<Receipt className="h-4 w-4" />}
              label={t('type')}
              value={`${payment.type} / ${payment.subType}`}
            />

            {/* Date */}
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label={t('date')}
              value={formatDate(payment.completedAt || payment.createdAt)}
            />

            {/* Contact */}
            {contact && (
              <DetailRow
                icon={<User className="h-4 w-4" />}
                label={tc('contact')}
                value={contact.name}
              />
            )}

            {/* Description */}
            {'description' in payment && payment.description && (
              <DetailRow
                icon={<FileText className="h-4 w-4" />}
                label={tc('description')}
                value={payment.description}
              />
            )}

            {/* Payment Hash */}
            {'paymentHash' in payment && payment.paymentHash && (
              <DetailRow
                icon={<Hash className="h-4 w-4" />}
                label={t('paymentHash')}
                value={truncateHash(payment.paymentHash)}
                copyable
                fullValue={payment.paymentHash}
                onCopy={() => copyToClipboard(payment.paymentHash!, 'hash')}
                copied={copiedField === 'hash'}
              />
            )}

            {/* Payment ID (for outgoing) */}
            {'paymentId' in payment && (
              <DetailRow
                icon={<Hash className="h-4 w-4" />}
                label={t('paymentId')}
                value={truncateHash((payment as OutgoingPayment).paymentId)}
                copyable
                fullValue={(payment as OutgoingPayment).paymentId}
                onCopy={() => copyToClipboard((payment as OutgoingPayment).paymentId, 'id')}
                copied={copiedField === 'id'}
              />
            )}

            {/* Preimage */}
            {'preimage' in payment && payment.preimage && (
              <DetailRow
                icon={<Key className="h-4 w-4" />}
                label={t('preimage')}
                value={truncateHash(payment.preimage)}
                copyable
                fullValue={payment.preimage}
                onCopy={() => copyToClipboard(payment.preimage!, 'preimage')}
                copied={copiedField === 'preimage'}
              />
            )}

            {/* Invoice */}
            {'invoice' in payment && payment.invoice && (
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    {tc('invoice')}
                  </div>
                  <button
                    onClick={() => copyToClipboard(payment.invoice!, 'invoice')}
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
                  {payment.invoice}
                </p>
              </div>
            )}

            {/* TX ID (for on-chain) */}
            {'txId' in payment && payment.txId && (
              <DetailRow
                icon={<ExternalLink className="h-4 w-4" />}
                label={t('transactionId')}
                value={truncateHash(payment.txId)}
                copyable
                fullValue={payment.txId}
                onCopy={() => copyToClipboard(payment.txId!, 'txid')}
                copied={copiedField === 'txid'}
                link={getMempoolUrl(chain, payment.txId)}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DetailRow };
