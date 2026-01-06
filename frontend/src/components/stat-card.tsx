'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatCardVariant = 'success' | 'primary' | 'warning' | 'error' | 'muted';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatCardVariant;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<StatCardVariant, { text: string; bg: string }> = {
  success: { text: 'text-success', bg: 'bg-success/10' },
  primary: { text: 'text-primary', bg: 'bg-primary/10' },
  warning: { text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  error: { text: 'text-red-500', bg: 'bg-red-500/10' },
  muted: { text: 'text-muted-foreground', bg: 'bg-white/5' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'muted',
  className,
  onClick,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'glass-card rounded-xl md:rounded-2xl p-3 md:p-5 group md:hover:scale-[1.02] transition-all',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] md:text-sm text-muted-foreground">{label}</p>
          <p className={cn('text-sm md:text-2xl font-bold mt-0.5 md:mt-1 truncate', styles.text)}>
            {value}
          </p>
        </div>
        <div
          className={cn(
            'hidden md:flex h-12 w-12 rounded-xl items-center justify-center group-hover:scale-110 transition-transform',
            styles.bg
          )}
        >
          <Icon className={cn('h-6 w-6', styles.text)} />
        </div>
      </div>
    </div>
  );
}

interface StatCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatCardGrid({ children, columns = 3, className }: StatCardGridProps) {
  const colsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-2 md:gap-4', colsClass[columns], className)}>{children}</div>
  );
}
