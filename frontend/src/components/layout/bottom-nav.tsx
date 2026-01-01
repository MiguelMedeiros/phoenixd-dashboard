'use client';

import { Link, usePathname } from '@/i18n/navigation';
import {
  Home,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  MoreHorizontal,
  Layers,
  Wrench,
  Link2,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

const mainNavItems = [
  { key: 'overview', href: '/', icon: Home },
  { key: 'receive', href: '/receive', icon: ArrowDownToLine },
  { key: 'send', href: '/send', icon: ArrowUpFromLine },
  { key: 'payments', href: '/payments', icon: History },
];

const moreNavItems = [
  { key: 'channels', href: '/channels', icon: Layers },
  { key: 'tools', href: '/tools', icon: Wrench },
  { key: 'lnurl', href: '/lnurl', icon: Link2 },
];

export function BottomNav() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive =
    moreNavItems.some((item) => item.href === pathname) || pathname === '/settings';

  return (
    <>
      {/* More Menu Overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More Menu */}
      {moreOpen && (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden">
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">{t('more')}</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {moreNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                    isActive
                      ? 'bg-primary text-white'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{t(item.key)}</span>
                </Link>
              );
            })}

            <div className="border-t border-black/10 dark:border-white/10 pt-2 mt-2">
              <Link
                href="/settings"
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all',
                  pathname === '/settings'
                    ? 'bg-primary text-white'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground'
                )}
              >
                <Settings className="h-5 w-5" />
                <span className="font-medium">{t('settings')}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden">
        <div className="glass-card border-t border-black/10 dark:border-white/10 px-2 pb-safe">
          <div className="flex items-center justify-around py-2">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-1 py-2 px-3 min-w-[56px]"
                >
                  <div
                    className={cn(
                      'p-2 rounded-xl transition-all',
                      isActive
                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                        : 'text-muted-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {t(item.key)}
                  </span>
                </Link>
              );
            })}

            {/* More Button */}
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex flex-col items-center gap-1 py-2 px-3 min-w-[56px]"
            >
              <div
                className={cn(
                  'p-2 rounded-xl transition-all',
                  isMoreActive || moreOpen
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'text-muted-foreground'
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isMoreActive || moreOpen ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {t('more')}
              </span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
