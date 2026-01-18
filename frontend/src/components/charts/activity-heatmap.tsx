'use client';

import { useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import type { IncomingPayment, OutgoingPayment } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface ActivityHeatmapProps {
  incomingPayments: IncomingPayment[];
  outgoingPayments: OutgoingPayment[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColorIntensity(count: number, maxCount: number): string {
  if (count === 0) return 'bg-white/5';
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  if (intensity < 0.25) return 'bg-primary/20';
  if (intensity < 0.5) return 'bg-primary/40';
  if (intensity < 0.75) return 'bg-primary/60';
  return 'bg-primary/80';
}

export function ActivityHeatmap({ incomingPayments, outgoingPayments }: ActivityHeatmapProps) {
  const t = useTranslations('analytics');

  const { heatmapData, maxCount } = useMemo(() => {
    const allPayments = [...incomingPayments, ...outgoingPayments].filter((p) => p.isPaid);
    const data: Record<string, number> = {};
    let max = 0;

    // Initialize all slots with 0
    DAYS.forEach((_, dayIndex) => {
      HOURS.forEach((hour) => {
        data[`${dayIndex}-${hour}`] = 0;
      });
    });

    // Count payments per slot
    allPayments.forEach((payment) => {
      const date = new Date(payment.completedAt || payment.createdAt);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}-${hour}`;
      data[key] = (data[key] || 0) + 1;
      if (data[key] > max) max = data[key];
    });

    return { heatmapData: data, maxCount: max };
  }, [incomingPayments, outgoingPayments]);

  const hasData = Object.values(heatmapData).some((count) => count > 0);

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

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hours header */}
          <div className="flex mb-2">
            <div className="w-12" /> {/* Spacer for day labels */}
            {HOURS.filter((h) => h % 3 === 0).map((hour) => (
              <div
                key={hour}
                className="flex-1 text-center text-xs text-muted-foreground"
                style={{ minWidth: '20px' }}
              >
                {hour.toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="space-y-1">
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-1">
                <div className="w-12 text-xs text-muted-foreground">{day}</div>
                <div className="flex-1 flex gap-0.5">
                  {HOURS.map((hour) => {
                    const count = heatmapData[`${dayIndex}-${hour}`] || 0;
                    return (
                      <div
                        key={`${dayIndex}-${hour}`}
                        className={`flex-1 h-6 rounded-sm transition-colors cursor-default ${getColorIntensity(count, maxCount)}`}
                        title={`${day} ${hour}:00 - ${count} ${count === 1 ? 'payment' : 'payments'}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-xs text-muted-foreground">{t('less')}</span>
            <div className="flex gap-0.5">
              <div className="w-4 h-4 rounded-sm bg-white/5" />
              <div className="w-4 h-4 rounded-sm bg-primary/20" />
              <div className="w-4 h-4 rounded-sm bg-primary/40" />
              <div className="w-4 h-4 rounded-sm bg-primary/60" />
              <div className="w-4 h-4 rounded-sm bg-primary/80" />
            </div>
            <span className="text-xs text-muted-foreground">{t('more')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
