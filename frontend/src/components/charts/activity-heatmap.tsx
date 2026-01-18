'use client';

import { useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import { ActivityCalendar, type Activity } from 'react-activity-calendar';
import type { IncomingPayment, OutgoingPayment } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

interface ActivityHeatmapProps {
  incomingPayments: IncomingPayment[];
  outgoingPayments: OutgoingPayment[];
}

interface DayData {
  date: string;
  count: number;
  incomingCount: number;
  outgoingCount: number;
  incomingAmount: number;
  outgoingAmount: number;
}

// Custom theme matching our dashboard colors (orange/primary gradient)
// First color is for empty days - using a visible gray for better contrast
const customTheme = {
  dark: ['#3d3d3d', '#5a3a20', '#7a4a28', '#a55a28', '#f97316'], // Dark mode: visible gray to bright orange
};

export function ActivityHeatmap({ incomingPayments, outgoingPayments }: ActivityHeatmapProps) {
  const t = useTranslations('analytics');

  const { calendarData, dayDataMap } = useMemo(() => {
    const dataMap: Record<string, DayData> = {};

    // Get date range (last 365 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    // Initialize all days in range
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      dataMap[dateStr] = {
        date: dateStr,
        count: 0,
        incomingCount: 0,
        outgoingCount: 0,
        incomingAmount: 0,
        outgoingAmount: 0,
      };
      current.setDate(current.getDate() + 1);
    }

    // Process incoming payments
    incomingPayments
      .filter((p) => p.isPaid)
      .forEach((payment) => {
        const date = new Date(payment.completedAt || payment.createdAt);
        const dateStr = date.toISOString().split('T')[0];
        if (dataMap[dateStr]) {
          dataMap[dateStr].count += 1;
          dataMap[dateStr].incomingCount += 1;
          dataMap[dateStr].incomingAmount += payment.receivedSat || 0;
        }
      });

    // Process outgoing payments
    outgoingPayments
      .filter((p) => p.isPaid)
      .forEach((payment) => {
        const date = new Date(payment.completedAt || payment.createdAt);
        const dateStr = date.toISOString().split('T')[0];
        if (dataMap[dateStr]) {
          dataMap[dateStr].count += 1;
          dataMap[dateStr].outgoingCount += 1;
          dataMap[dateStr].outgoingAmount += payment.sent || 0;
        }
      });

    // Find max count for level calculation
    const maxCount = Math.max(...Object.values(dataMap).map((d) => d.count), 1);

    // Convert to Activity format with levels
    const activities: Activity[] = Object.values(dataMap).map((day) => ({
      date: day.date,
      count: day.count,
      level:
        day.count === 0
          ? 0
          : (Math.min(Math.ceil((day.count / maxCount) * 4), 4) as 0 | 1 | 2 | 3 | 4),
    }));

    return { calendarData: activities, dayDataMap: dataMap };
  }, [incomingPayments, outgoingPayments]);

  const hasData = calendarData.some((day) => day.count > 0);

  const formatSats = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k`;
    }
    return amount.toLocaleString();
  };

  if (!hasData) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Grid3X3 className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold">{t('activityHeatmap')}</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-[200px] text-center">
          <div className="h-14 w-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
            <Grid3X3 className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{t('noActivityData')}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{t('startMakingPayments')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Grid3X3 className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold">{t('activityHeatmap')}</h3>
      </div>

      <div className="overflow-x-auto flex justify-center">
        <ActivityCalendar
          data={calendarData}
          theme={customTheme}
          colorScheme="dark"
          blockSize={12}
          blockMargin={3}
          blockRadius={2}
          fontSize={11}
          showWeekdayLabels
          showTotalCount={false}
          labels={{
            totalCount: '{{count}} payments in {{year}}',
            legend: {
              less: t('less'),
              more: t('more'),
            },
          }}
          renderBlock={(block, activity) => {
            const dayData = dayDataMap[activity.date];
            const tooltipContent =
              dayData && dayData.count > 0
                ? `<div class="text-left">
                  <div class="font-medium mb-1">${new Date(activity.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                  <div class="text-sm">${t('payments')}: ${dayData.count}</div>
                  ${dayData.incomingCount > 0 ? `<div class="text-sm text-emerald-400">↓ ${dayData.incomingCount} received (${formatSats(dayData.incomingAmount)} sats)</div>` : ''}
                  ${dayData.outgoingCount > 0 ? `<div class="text-sm text-orange-400">↑ ${dayData.outgoingCount} sent (${formatSats(dayData.outgoingAmount)} sats)</div>` : ''}
                </div>`
                : `<div>${new Date(activity.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}<br/>${t('noPayments')}</div>`;

            return (
              <g>
                {block}
                <rect
                  x={block.props.x}
                  y={block.props.y}
                  width={block.props.width}
                  height={block.props.height}
                  fill="transparent"
                  data-tooltip-id="activity-tooltip"
                  data-tooltip-html={tooltipContent}
                />
              </g>
            );
          }}
        />
        <ReactTooltip
          id="activity-tooltip"
          className="!bg-background/95 !backdrop-blur-sm !border !border-border !shadow-xl !rounded-lg !px-3 !py-2 !text-foreground"
        />
      </div>
    </div>
  );
}
