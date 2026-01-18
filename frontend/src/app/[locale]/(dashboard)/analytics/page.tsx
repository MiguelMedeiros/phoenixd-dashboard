'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import {
  getIncomingPayments,
  getOutgoingPayments,
  getContacts,
  batchGetPaymentMetadata,
  type IncomingPayment,
  type OutgoingPayment,
  type Contact,
  type PaymentMetadata,
} from '@/lib/api';
import { useCurrencyContext } from '@/components/currency-provider';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/page-header';
import { StatCard, StatCardGrid } from '@/components/stat-card';
import { useTranslations } from 'next-intl';

// Chart components
import { ActivityHeatmap } from '@/components/charts/activity-heatmap';
import { FeesComparisonChart } from '@/components/charts/fees-comparison-chart';
import { MonthlyComparisonChart } from '@/components/charts/monthly-comparison-chart';
import { TopContactsChart } from '@/components/charts/top-contacts-chart';

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { formatValue } = useCurrencyContext();
  const [incomingPayments, setIncomingPayments] = useState<IncomingPayment[]>([]);
  const [outgoingPayments, setOutgoingPayments] = useState<OutgoingPayment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [paymentMetadata, setPaymentMetadata] = useState<Record<string, PaymentMetadata>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [incoming, outgoing, contactsList] = await Promise.all([
        getIncomingPayments({ limit: 500 }),
        getOutgoingPayments({ limit: 500 }),
        getContacts(),
      ]);

      setIncomingPayments(incoming || []);
      setOutgoingPayments(outgoing || []);
      setContacts(contactsList || []);

      // Fetch metadata for all payments
      const paymentHashes = (incoming || []).map((p) => p.paymentHash).filter(Boolean);
      const paymentIds = (outgoing || []).map((p) => p.paymentId).filter(Boolean);

      if (paymentHashes.length > 0 || paymentIds.length > 0) {
        try {
          const metadata = await batchGetPaymentMetadata({ paymentHashes, paymentIds });
          setPaymentMetadata(metadata);
        } catch {
          // Ignore metadata fetch errors - it's optional
        }
      }
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: te('failedToLoadPayments'),
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tc, te]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing analytics data...');
      setTimeout(fetchData, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchData]);

  // Calculate stats
  const totalReceived = incomingPayments
    .filter((p) => p.isPaid)
    .reduce((acc, p) => acc + p.receivedSat, 0);
  const totalSent = outgoingPayments.filter((p) => p.isPaid).reduce((acc, p) => acc + p.sent, 0);
  const totalFees = Math.floor(
    outgoingPayments.filter((p) => p.isPaid).reduce((acc, p) => acc + p.fees, 0) / 1000
  );
  const totalPayments =
    incomingPayments.filter((p) => p.isPaid).length +
    outgoingPayments.filter((p) => p.isPaid).length;

  if (loading) {
    return (
      <div className="pt-4 md:pt-6 space-y-6">
        <div className="h-10 w-48 bg-white/5 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Stats Grid */}
      <StatCardGrid columns={4}>
        <StatCard
          label={t('totalReceived')}
          value={formatValue(totalReceived)}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          label={t('totalSent')}
          value={formatValue(totalSent)}
          icon={TrendingDown}
          variant="primary"
        />
        <StatCard
          label={t('totalFees')}
          value={formatValue(totalFees)}
          icon={Zap}
          variant="warning"
        />
        <StatCard
          label={t('totalPayments')}
          value={totalPayments.toLocaleString()}
          icon={BarChart3}
          variant="muted"
        />
      </StatCardGrid>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity Heatmap */}
        <ActivityHeatmap incomingPayments={incomingPayments} outgoingPayments={outgoingPayments} />

        {/* Fees Comparison */}
        <FeesComparisonChart outgoingPayments={outgoingPayments} />

        {/* Monthly Comparison */}
        <MonthlyComparisonChart
          incomingPayments={incomingPayments}
          outgoingPayments={outgoingPayments}
        />

        {/* Top Contacts */}
        <TopContactsChart
          contacts={contacts}
          paymentMetadata={paymentMetadata}
          incomingPayments={incomingPayments}
          outgoingPayments={outgoingPayments}
        />
      </div>
    </div>
  );
}
