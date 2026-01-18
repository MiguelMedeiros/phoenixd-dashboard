'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PieChartIcon, Wallet } from 'lucide-react';
import type { IncomingPayment, OutgoingPayment } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface PaymentDistributionChartProps {
  incomingPayments: IncomingPayment[];
  outgoingPayments: OutgoingPayment[];
}

interface ChartData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

const COLORS = {
  received: '#22c55e', // Green
  sent: '#f97316', // Orange
  fees: '#8b5cf6', // Purple
};

// Custom tooltip component
const CustomTooltip = ({
  active,
  payload,
  translations,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartData }>;
  translations: { sats: string };
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-card rounded-xl p-3 border border-black/10 dark:border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
          <span className="font-medium text-foreground">{data.name}</span>
        </div>
        <div className="mt-1 text-sm">
          <span className="font-mono font-medium">
            {data.value.toLocaleString()} {translations.sats}
          </span>
          <span className="text-muted-foreground ml-2">({data.percentage.toFixed(1)}%)</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom label for pie slices
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) => {
  if (percent < 0.05) return null; // Don't show label for very small slices

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function PaymentDistributionChart({
  incomingPayments,
  outgoingPayments,
}: PaymentDistributionChartProps) {
  const t = useTranslations('analytics');
  const tc = useTranslations('common');

  const tooltipTranslations = {
    sats: tc('sats'),
  };

  const { chartData, hasData } = useMemo(() => {
    const totalReceived = incomingPayments
      .filter((p) => p.isPaid)
      .reduce((acc, p) => acc + p.receivedSat, 0);

    const totalSent = outgoingPayments.filter((p) => p.isPaid).reduce((acc, p) => acc + p.sent, 0);

    // Fees from phoenixd are in millisatoshis
    const totalFees = Math.floor(
      outgoingPayments.filter((p) => p.isPaid).reduce((acc, p) => acc + p.fees, 0) / 1000
    );

    const total = totalReceived + totalSent + totalFees;

    if (total === 0) {
      return { chartData: [], hasData: false };
    }

    const data: ChartData[] = [];

    if (totalReceived > 0) {
      data.push({
        name: t('received'),
        value: totalReceived,
        color: COLORS.received,
        percentage: (totalReceived / total) * 100,
      });
    }

    if (totalSent > 0) {
      data.push({
        name: t('sent'),
        value: totalSent,
        color: COLORS.sent,
        percentage: (totalSent / total) * 100,
      });
    }

    if (totalFees > 0) {
      data.push({
        name: t('fees'),
        value: totalFees,
        color: COLORS.fees,
        percentage: (totalFees / total) * 100,
      });
    }

    return { chartData: data, hasData: data.length > 0 };
  }, [incomingPayments, outgoingPayments, t]);

  if (!hasData) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <PieChartIcon className="h-4 w-4 text-violet-500" />
          </div>
          <h3 className="font-semibold">{t('paymentDistribution')}</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[200px] text-center">
          <div className="h-14 w-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
            <Wallet className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('noDistributionData')}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{t('startMakingPayments')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <PieChartIcon className="h-4 w-4 text-violet-500" />
        </div>
        <h3 className="font-semibold">{t('paymentDistribution')}</h3>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={90}
              innerRadius={45}
              dataKey="value"
              animationDuration={1000}
              animationBegin={0}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="transparent"
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip translations={tooltipTranslations} />} />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
