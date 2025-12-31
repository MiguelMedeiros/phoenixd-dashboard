'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Layers,
  Wrench,
  Link2,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNodeInfo } from '@/lib/api';
import { NodeInfoDialog } from '@/components/node-info-dialog';

const sidebarNavItems = [
  {
    title: 'Overview',
    href: '/',
    icon: Home,
  },
  {
    title: 'Receive',
    href: '/receive',
    icon: ArrowDownToLine,
  },
  {
    title: 'Send',
    href: '/send',
    icon: ArrowUpFromLine,
  },
  {
    title: 'Payments',
    href: '/payments',
    icon: History,
  },
  {
    title: 'Channels',
    href: '/channels',
    icon: Layers,
  },
  {
    title: 'Tools',
    href: '/tools',
    icon: Wrench,
  },
  {
    title: 'LNURL',
    href: '/lnurl',
    icon: Link2,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [chain, setChain] = useState<string>('mainnet');
  const [nodeInfoOpen, setNodeInfoOpen] = useState(false);

  // Persist state in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    if (saved !== null) {
      setExpanded(saved === 'true');
    }
  }, []);

  // Fetch network info
  useEffect(() => {
    const fetchNodeInfo = async () => {
      try {
        const info = await getNodeInfo();
        setChain(info.chain || 'mainnet');
      } catch (error) {
        console.error('Error fetching node info:', error);
      }
    };
    fetchNodeInfo();
  }, []);

  const toggleExpanded = () => {
    const newValue = !expanded;
    setExpanded(newValue);
    localStorage.setItem('sidebar-expanded', String(newValue));
  };

  return (
    <>
      <aside
        className={cn(
          'warm-sidebar relative flex h-full flex-col py-6 transition-all duration-300 ease-out',
          expanded ? 'w-[220px] px-4' : 'w-[88px] items-center'
        )}
      >
        {/* Logo & Brand */}
        <div className={cn('mb-8', expanded ? 'px-2' : '')}>
          <div className={cn('flex items-center gap-3', expanded ? '' : 'flex-col justify-center')}>
            <div className="relative flex-shrink-0">
              <div className="icon-circle !w-12 !h-12 !bg-gradient-to-br !from-primary/20 !to-accent/20">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl -z-10" />
            </div>
            {expanded ? (
              <div className="overflow-hidden flex-1">
                <h1 className="font-bold text-lg tracking-tight whitespace-nowrap">Phoenixd</h1>
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      chain === 'mainnet'
                        ? 'bg-bitcoin shadow-[0_0_6px_hsl(var(--bitcoin))]'
                        : 'bg-yellow-500 shadow-[0_0_6px_hsl(45,100%,50%)]'
                    )}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {chain === 'mainnet' ? 'Mainnet' : 'Testnet'}
                  </span>
                </div>
              </div>
            ) : (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider',
                  chain === 'mainnet'
                    ? 'bg-bitcoin/20 text-bitcoin'
                    : 'bg-yellow-500/20 text-yellow-500'
                )}
              >
                {chain === 'mainnet' ? 'Main' : 'Test'}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn('flex flex-1 flex-col gap-1.5', expanded ? '' : 'items-center')}>
          {sidebarNavItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href} title={expanded ? undefined : item.title}>
                <div
                  className={cn(
                    'group flex items-center gap-3 transition-all duration-200',
                    expanded
                      ? cn(
                          'px-3 py-2.5 rounded-xl',
                          isActive
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'
                        )
                      : cn('icon-circle', isActive && 'active')
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 flex-shrink-0 transition-all duration-200',
                      isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {expanded && (
                    <span
                      className={cn(
                        'text-sm font-medium whitespace-nowrap transition-colors',
                        isActive ? 'text-white' : ''
                      )}
                    >
                      {item.title}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div
          className={cn(
            'flex flex-col gap-2 pt-6 border-t border-black/5 dark:border-white/5',
            expanded ? '' : 'items-center'
          )}
        >
          {/* Settings Link */}
          <Link href="/settings" title={expanded ? undefined : 'Settings'}>
            <div
              className={cn(
                'group flex items-center gap-3 transition-all duration-200',
                expanded
                  ? cn(
                      'px-3 py-2.5 rounded-xl',
                      pathname === '/settings'
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'
                    )
                  : cn('icon-circle', pathname === '/settings' && 'active')
              )}
            >
              <Settings
                className={cn(
                  'h-5 w-5 flex-shrink-0 transition-colors',
                  pathname === '/settings'
                    ? 'text-white'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {expanded && (
                <span
                  className={cn(
                    'text-sm font-medium whitespace-nowrap transition-colors',
                    pathname === '/settings' ? 'text-white' : ''
                  )}
                >
                  Settings
                </span>
              )}
            </div>
          </Link>

          {/* Node Info Button */}
          <button
            onClick={() => setNodeInfoOpen(true)}
            title={expanded ? undefined : 'Node Info'}
            className={cn(
              'group flex items-center gap-3 transition-all duration-200 w-full',
              expanded
                ? 'px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'
                : 'icon-circle'
            )}
          >
            <Server className="h-5 w-5 flex-shrink-0 transition-colors text-muted-foreground group-hover:text-foreground" />
            {expanded && (
              <span className="text-sm font-medium whitespace-nowrap transition-colors">
                Node Info
              </span>
            )}
          </button>

          {/* Expand/Collapse Button */}
          <button
            onClick={toggleExpanded}
            className={cn(
              'mt-2 flex items-center justify-center gap-2 transition-all duration-200',
              expanded
                ? 'px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground w-full'
                : 'icon-circle !w-10 !h-10'
            )}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs font-medium">Collapse</span>
              </>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </aside>

      {/* Node Info Dialog */}
      <NodeInfoDialog open={nodeInfoOpen} onClose={() => setNodeInfoOpen(false)} />
    </>
  );
}
