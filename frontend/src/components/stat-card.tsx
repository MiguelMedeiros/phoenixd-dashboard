'use client';

import { LucideIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type StatCardVariant =
  | 'success'
  | 'primary'
  | 'warning'
  | 'error'
  | 'muted'
  | 'info'
  | 'accent';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatCardVariant;
  className?: string;
  onClick?: () => void;
  tooltip?: string;
}

const variantStyles: Record<StatCardVariant, { text: string; bg: string }> = {
  success: { text: 'text-success', bg: 'bg-success/10' },
  primary: { text: 'text-primary', bg: 'bg-primary/10' },
  warning: { text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  error: { text: 'text-red-500', bg: 'bg-red-500/10' },
  muted: { text: 'text-muted-foreground', bg: 'bg-white/5' },
  info: { text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  accent: { text: 'text-purple-500', bg: 'bg-purple-500/10' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'muted',
  className,
  onClick,
  tooltip,
}: StatCardProps) {
  const styles = variantStyles[variant];

  const content = (
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
          <div className="flex items-center gap-1">
            <p className="text-[10px] md:text-sm text-muted-foreground">{label}</p>
            {tooltip && (
              <Info className="h-3 w-3 text-muted-foreground/50 hidden md:inline-block" />
            )}
          </div>
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

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent className="max-w-xs text-sm">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

interface StatCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}

export function StatCardGrid({ children, columns = 3, className }: StatCardGridProps) {
  const colsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return <div className={cn('grid gap-2 md:gap-4', colsClass[columns], className)}>{children}</div>;
}
