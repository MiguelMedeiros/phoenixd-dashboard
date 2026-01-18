'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subMonths, startOfMonth, isSameMonth, eachMonthOfInterval } from 'date-fns';
import { BarChart3, TrendingUp } from 'lucide-react';
import type { IncomingPayment, OutgoingPayment } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface MonthlyComparisonChartProps {
  incomingPayments: IncomingPayment[];
  outgoingPayments: OutgoingPayment[];
}

interface ChartData {
  month: string;
  monthLabel: string;
  received: number;
  sent: number;
}

// Custom tooltip component
const CustomTooltip = ({
  active,
  payload,
  label,
  translations,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
  translations: { received: string; sent: string; sats: string };
}) => {
  if (active && payload && payload.length) {
    const keyLabels: Record<string, string> = {
      received: translations.received,
      sent: translations.sent,
    };

    return (
      <div className="glass-card rounded-xl p-3 border border-black/10 dark:border-white/10 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">
              {keyLabels[entry.dataKey] || entry.dataKey}:
            </span>
            <span className="font-mono font-medium">
              {entry.value.toLocaleString()} {translations.sats}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function MonthlyComparisonChart({
  incomingPayments,
  outgoingPayments,
}: MonthlyComparisonChartProps) {
  const t = useTranslations('analytics');
  const tc = useTranslations('common');

  const tooltipTranslations = {
    received: tc('received'),
    sent: tc('sent'),
    sats: tc('sats'),
  };

  const legendLabels: Record<string, string> = {
    received: tc('received'),
    sent: tc('sent'),
  };

  const chartData = useMemo(() => {
    const now = new Date();
    const months = 6;
    const startDate = subMonths(now, months - 1);
    const intervals = eachMonthOfInterval({ start: startDate, end: now });
    const data: ChartData[] = [];

    intervals.forEach((date) => {
      const monthStart = startOfMonth(date);
      const monthStr = format(monthStart, 'yyyy-MM');
      const monthLabel = format(monthStart, 'MMM');

      const received = incomingPayments
        .filter((p) => p.isPaid && isSameMonth(new Date(p.completedAt || p.createdAt), monthStart))
        .reduce((sum, p) => sum + p.receivedSat, 0);

      const sent = outgoingPayments
        .filter((p) => p.isPaid && isSameMonth(new Date(p.completedAt || p.createdAt), monthStart))
        .reduce((sum, p) => sum + p.sent, 0);

      data.push({ month: monthStr, monthLabel, received, sent });
    });

    return data;
  }, [incomingPayments, outgoingPayments]);

  const hasData = chartData.some((d) => d.received > 0 || d.sent > 0);

  if (!hasData) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-success" />
          </div>
          <h3 className="font-semibold">{t('monthlyComparison')}</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[200px] text-center">
          <div className="h-14 w-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
            <TrendingUp className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('noMonthlyData')}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{t('startMakingPayments')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-success/10 flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-success" />
        </div>
        <h3 className="font-semibold">{t('monthlyComparison')}</h3>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)}
              width={45}
            />
            <Tooltip content={<CustomTooltip translations={tooltipTranslations} />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">
                  {legendLabels[value as string] || value}
                </span>
              )}
            />
            <Bar dataKey="received" fill="#22c55e" radius={[4, 4, 0, 0]} animationDuration={1000} />
            <Bar dataKey="sent" fill="#f97316" radius={[4, 4, 0, 0]} animationDuration={1000} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
