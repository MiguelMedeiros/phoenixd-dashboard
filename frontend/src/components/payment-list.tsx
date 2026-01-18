'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PaymentListItem, type Payment } from '@/components/payment-list-item';
import { PaymentDetailsDialog } from '@/components/payment-details-dialog';
import { CategoryManager } from '@/components/category-manager';
import {
  getCategories,
  getNodeInfo,
  batchGetPaymentMetadata,
  updatePaymentMetadata,
  type IncomingPayment,
  type OutgoingPayment,
  type PaymentCategory,
  type PaymentMetadata,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface PaymentListProps {
  payments: Payment[];
  formatValue: (value: number) => string;
  variant?: 'default' | 'compact';
  limit?: number;
  showCategories?: boolean;
  showFees?: boolean;
  showArrow?: boolean;
  showDetailsDialog?: boolean;
  emptyIcon?: 'incoming' | 'outgoing' | 'zap';
  emptyMessage?: string;
  emptySubMessage?: string;
  className?: string;
}

export function PaymentList({
  payments,
  formatValue,
  variant = 'default',
  limit,
  showCategories = true,
  showFees = true,
  showArrow = true,
  showDetailsDialog = true,
  emptyIcon = 'zap',
  emptyMessage,
  emptySubMessage,
  className,
}: PaymentListProps) {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const { toast } = useToast();

  // State for payment details dialog
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentMetadataMap, setPaymentMetadataMap] = useState<Record<string, PaymentMetadata>>({});
  const [selectedPaymentMetadata, setSelectedPaymentMetadata] = useState<PaymentMetadata | null>(
    null
  );
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [chain, setChain] = useState<string>('mainnet');

  // Fetch categories and chain info
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cats, nodeInfo] = await Promise.all([getCategories(), getNodeInfo()]);
        setCategories(cats || []);
        setChain(nodeInfo.chain || 'mainnet');
      } catch {
        // Ignore errors - categories are optional
      }
    };
    fetchData();
  }, []);

  // Fetch metadata for payments
  useEffect(() => {
    const fetchMetadata = async () => {
      if (payments.length === 0) return;

      const paymentHashes = payments
        .filter((p) => 'receivedSat' in p)
        .map((p) => (p as IncomingPayment).paymentHash)
        .filter(Boolean);
      const paymentIds = payments
        .filter((p) => !('receivedSat' in p))
        .map((p) => (p as OutgoingPayment).paymentId)
        .filter(Boolean);

      if (paymentHashes.length === 0 && paymentIds.length === 0) return;

      try {
        const metadata = await batchGetPaymentMetadata({ paymentHashes, paymentIds });
        setPaymentMetadataMap(metadata);
      } catch {
        // Ignore metadata fetch errors - it's optional
      }
    };
    fetchMetadata();
  }, [payments]);

  // Update selected payment metadata when selection changes
  useEffect(() => {
    if (selectedPayment) {
      const isIncoming = 'receivedSat' in selectedPayment;
      if (isIncoming) {
        const paymentHash = (selectedPayment as IncomingPayment).paymentHash;
        setSelectedPaymentMetadata(paymentMetadataMap[paymentHash] || null);
      } else {
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

  const handleUpdateMetadata = useCallback(
    async (
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
    },
    [toast, tc]
  );

  const handleToggleCategory = useCallback(
    async (categoryId: string) => {
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
    },
    [selectedPayment, selectedPaymentMetadata, handleUpdateMetadata]
  );

  // Get metadata for a payment
  const getMetadata = (payment: Payment): PaymentMetadata | undefined => {
    const isIncoming = 'receivedSat' in payment;
    if (isIncoming) {
      return paymentMetadataMap[(payment as IncomingPayment).paymentHash];
    }
    const outgoing = payment as OutgoingPayment;
    return (
      paymentMetadataMap[outgoing.paymentId] ||
      (outgoing.paymentHash ? paymentMetadataMap[outgoing.paymentHash] : undefined)
    );
  };

  // Limit payments if specified
  const displayPayments = limit ? payments.slice(0, limit) : payments;

  // Empty state icon
  const EmptyIcon =
    emptyIcon === 'incoming' ? ArrowDownToLine : emptyIcon === 'outgoing' ? ArrowUpFromLine : Zap;

  if (displayPayments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div
          className={`h-12 w-12 rounded-${variant === 'compact' ? 'full' : 'xl'} bg-white/5 flex items-center justify-center mb-3`}
        >
          <EmptyIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage || t('noPayments')}</p>
        {emptySubMessage && (
          <p className="text-xs text-muted-foreground/70 mt-1">{emptySubMessage}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={className}>
        {variant === 'compact' ? (
          <div className="space-y-0.5">
            {displayPayments.map((payment) => {
              const key =
                'receivedSat' in payment
                  ? (payment as IncomingPayment).paymentHash
                  : (payment as OutgoingPayment).paymentId;

              return (
                <PaymentListItem
                  key={key}
                  payment={payment}
                  metadata={showCategories ? getMetadata(payment) : undefined}
                  formatValue={formatValue}
                  variant="compact"
                  showCategories={showCategories}
                  showFees={showFees}
                  showArrow={showArrow && showDetailsDialog}
                  onClick={showDetailsDialog ? () => setSelectedPayment(payment) : undefined}
                />
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {displayPayments.map((payment, index) => {
              const key =
                'receivedSat' in payment
                  ? (payment as IncomingPayment).paymentHash
                  : (payment as OutgoingPayment).paymentId;

              return (
                <PaymentListItem
                  key={key}
                  payment={payment}
                  metadata={showCategories ? getMetadata(payment) : undefined}
                  formatValue={formatValue}
                  variant="default"
                  showCategories={showCategories}
                  showFees={showFees}
                  showArrow={showArrow && showDetailsDialog}
                  onClick={showDetailsDialog ? () => setSelectedPayment(payment) : undefined}
                  animationDelay={index * 30}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Details Dialog */}
      {showDetailsDialog && (
        <PaymentDetailsDialog
          open={!!selectedPayment}
          onOpenChange={(open) => !open && setSelectedPayment(null)}
          payment={selectedPayment}
          metadata={selectedPaymentMetadata}
          categories={categories}
          onUpdateNote={async (note) => {
            if (!selectedPayment) return;
            const isIncoming = 'receivedSat' in selectedPayment;
            const identifier = isIncoming
              ? (selectedPayment as IncomingPayment).paymentHash
              : (selectedPayment as OutgoingPayment).paymentId;
            if (identifier) {
              await handleUpdateMetadata(identifier, isIncoming, { note });
            }
          }}
          onToggleCategory={handleToggleCategory}
          onManageCategories={() => setShowCategoryManager(true)}
          formatValue={formatValue}
          chain={chain}
        />
      )}

      {/* Category Manager */}
      {showDetailsDialog && (
        <CategoryManager
          open={showCategoryManager}
          onClose={() => {
            setShowCategoryManager(false);
            getCategories().then(setCategories).catch(console.error);
          }}
        />
      )}
    </>
  );
}
