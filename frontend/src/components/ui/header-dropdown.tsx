'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: 'sm' | 'md' | 'lg';
}

export function HeaderDropdown({
  open,
  onOpenChange,
  title,
  badge,
  headerActions,
  footer,
  children,
  className,
  width = 'md',
}: HeaderDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onOpenChange]);

  if (!open) return null;

  const widthClasses = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
  };

  return (
    <>
      {/* Backdrop - captures clicks outside dropdown to close it */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => onOpenChange(false)}
        style={{ pointerEvents: 'auto' }}
      />

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className={cn('absolute right-0 top-full mt-2 z-50', widthClasses[width], className)}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/[0.08] animate-scale-in origin-top-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{title}</h3>
              {badge}
            </div>
            <div className="flex items-center gap-1">
              {headerActions}
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[400px] overflow-y-auto">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-4 py-3 border-t border-black/10 dark:border-white/10">{footer}</div>
          )}
        </div>
      </div>
    </>
  );
}

// Reusable item component for dropdown lists
interface HeaderDropdownItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

export function HeaderDropdownItem({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  active,
  disabled,
  className,
}: HeaderDropdownItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
        'hover:bg-black/5 dark:hover:bg-white/5',
        active && 'bg-primary/5',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {trailing}
    </button>
  );
}
