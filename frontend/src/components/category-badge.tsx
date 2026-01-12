'use client';

import { cn } from '@/lib/utils';
import type { PaymentCategory } from '@/lib/api';

interface CategoryBadgeProps {
  category: PaymentCategory;
  size?: 'sm' | 'md';
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}

export function CategoryBadge({
  category,
  size = 'sm',
  onClick,
  removable,
  onRemove,
}: CategoryBadgeProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        onClick && 'cursor-pointer hover:opacity-80'
      )}
      style={{
        backgroundColor: `${category.color}20`,
        color: category.color,
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-60 transition-opacity"
        >
          ×
        </button>
      )}
    </span>
  );
}
