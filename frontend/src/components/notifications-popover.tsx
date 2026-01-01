'use client';

import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Bell, Check, Trash2, X, Zap } from 'lucide-react';
import { cn, formatSats } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export interface Notification {
  id: string;
  type: 'payment_received' | 'payment_sent' | 'channel' | 'info';
  title: string;
  message: string;
  amount?: number;
  timestamp: number;
  read: boolean;
}

interface NotificationsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
}

export function NotificationsPopover({
  open,
  onOpenChange,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClear,
  onRemove,
}: NotificationsPopoverProps) {
  const t = useTranslations('notifications');
  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('justNow');
    if (minutes < 60) return t('minutesAgo', { minutes });
    if (hours < 24) return t('hoursAgo', { hours });
    if (days < 7) return t('daysAgo', { days });
    return date.toLocaleDateString();
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'payment_received':
        return <ArrowDownToLine className="h-4 w-4 text-success" />;
      case 'payment_sent':
        return <ArrowUpFromLine className="h-4 w-4 text-primary" />;
      case 'channel':
        return <Zap className="h-4 w-4 text-lightning" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />

      {/* Popover */}
      <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/[0.08] animate-scale-in origin-top-right">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t('title')}</h3>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-xs font-medium text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={onMarkAllAsRead}
                    className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    title={t('markAllRead')}
                  >
                    <Check className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={onClear}
                    className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    title={t('clearAll')}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 dark:bg-white/5 mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t('noNotifications')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('allCaughtUp')}</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group',
                      !notification.read && 'bg-primary/5'
                    )}
                    onClick={() => onMarkAsRead(notification.id)}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        notification.type === 'payment_received' && 'bg-success/10',
                        notification.type === 'payment_sent' && 'bg-primary/10',
                        notification.type === 'channel' && 'bg-lightning/10',
                        notification.type === 'info' && 'bg-black/5 dark:bg-white/5'
                      )}
                    >
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(notification.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {notification.amount !== undefined && (
                          <span
                            className={cn(
                              'text-xs font-medium',
                              notification.type === 'payment_received'
                                ? 'text-success'
                                : 'text-primary'
                            )}
                          >
                            {notification.type === 'payment_received' ? '+' : '-'}
                            {formatSats(notification.amount)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(notification.timestamp)}
                        </span>
                        {!notification.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
