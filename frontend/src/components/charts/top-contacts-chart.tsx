'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, TrendingUp } from 'lucide-react';
import type { Contact, PaymentMetadata, IncomingPayment, OutgoingPayment } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface TopContactsChartProps {
  contacts: Contact[];
  paymentMetadata: Record<string, PaymentMetadata>;
  incomingPayments: IncomingPayment[];
  outgoingPayments: OutgoingPayment[];
}

interface ChartData {
  name: string;
  volume: number;
  count: number;
}

const COLORS = [
  '#f97316',
  '#22c55e',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#eab308',
  '#3b82f6',
  '#10b981',
  '#f43f5e',
  '#6366f1',
];

// Custom tooltip component
const CustomTooltip = ({
  active,
  payload,
  translations,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartData }>;
  translations: { volume: string; payments: string; sats: string };
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-card rounded-xl p-3 border border-black/10 dark:border-white/10 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{data.name}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{translations.volume}:</span>
            <span className="font-mono font-medium">
              {data.volume.toLocaleString()} {translations.sats}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{translations.payments}:</span>
            <span className="font-mono font-medium">{data.count}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function TopContactsChart({
  contacts,
  paymentMetadata,
  incomingPayments,
  outgoingPayments,
}: TopContactsChartProps) {
  const t = useTranslations('analytics');
  const tc = useTranslations('common');

  const tooltipTranslations = {
    volume: t('volume'),
    payments: t('payments'),
    sats: tc('sats'),
  };

  const chartData = useMemo(() => {
    // Create a map of contact ID to volume
    const contactVolumes: Record<string, { name: string; volume: number; count: number }> = {};

    // Initialize contacts
    contacts.forEach((contact) => {
      contactVolumes[contact.id] = { name: contact.name, volume: 0, count: 0 };
    });

    // Process outgoing payments
    outgoingPayments.forEach((payment) => {
      if (!payment.isPaid) return;
      const metadata = paymentMetadata[payment.paymentId];
      if (metadata?.contactId && contactVolumes[metadata.contactId]) {
        contactVolumes[metadata.contactId].volume += payment.sent;
        contactVolumes[metadata.contactId].count += 1;
      }
    });

    // Process incoming payments
    incomingPayments.forEach((payment) => {
      if (!payment.isPaid) return;
      const metadata = paymentMetadata[payment.paymentHash];
      if (metadata?.contactId && contactVolumes[metadata.contactId]) {
        contactVolumes[metadata.contactId].volume += payment.receivedSat;
        contactVolumes[metadata.contactId].count += 1;
      }
    });

    // Convert to array, sort by volume, and take top 10
    const sortedData: ChartData[] = Object.values(contactVolumes)
      .filter((c) => c.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10)
      .map((c) => ({
        name: c.name.length > 15 ? c.name.slice(0, 15) + '...' : c.name,
        volume: c.volume,
        count: c.count,
      }));

    return sortedData;
  }, [contacts, paymentMetadata, incomingPayments, outgoingPayments]);

  const hasData = chartData.length > 0;

  if (!hasData) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-cyan-500" />
          </div>
          <h3 className="font-semibold">{t('topContacts')}</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[200px] text-center">
          <div className="h-14 w-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
            <TrendingUp className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('noContactsData')}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{t('linkPaymentsToContacts')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-cyan-500" />
        </div>
        <h3 className="font-semibold">{t('topContacts')}</h3>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis
              type="number"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              content={<CustomTooltip translations={tooltipTranslations} />}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar dataKey="volume" radius={[0, 4, 4, 0]} animationDuration={1000}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
