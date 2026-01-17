'use client';

import { useState, useEffect } from 'react';
import { Server, Check, Loader2, Container, Globe } from 'lucide-react';
import {
  getPhoenixdConnections,
  activatePhoenixdConnection,
  type PhoenixdConnection,
} from '@/lib/api';
import { useTranslations } from 'next-intl';
import { HeaderDropdown, HeaderDropdownItem } from '@/components/ui/header-dropdown';
import { Link } from '@/i18n/navigation';

export function ConnectionSwitcher() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<PhoenixdConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const activeConnection = connections.find((c) => c.isActive);

  const fetchConnections = async () => {
    try {
      const data = await getPhoenixdConnections();
      setConnections(data);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleActivate = async (connection: PhoenixdConnection) => {
    if (connection.isActive) {
      setOpen(false);
      return;
    }

    setActivating(connection.id);
    // Dispatch event to show loading state on balance
    window.dispatchEvent(new CustomEvent('phoenixd:connection-changing'));
    try {
      await activatePhoenixdConnection(connection.id);
      await fetchConnections();
      // Dispatch event to update balance in header
      window.dispatchEvent(new CustomEvent('phoenixd:connection-changed'));
      setOpen(false);
    } catch (error) {
      console.error('Failed to activate connection:', error);
      // Dispatch changed event anyway to stop loading state
      window.dispatchEvent(new CustomEvent('phoenixd:connection-changed'));
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="icon-circle !w-9 !h-9 md:!w-11 md:!h-11">
        <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't show if only one connection
  if (connections.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="icon-circle !w-9 !h-9 md:!w-11 md:!h-11 relative group"
        title={activeConnection?.name || t('nodeConnection')}
      >
        {activeConnection?.isDocker ? (
          <Container className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        ) : (
          <Server className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
        {/* Active indicator - same style as notifications */}
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 md:h-3 md:w-3 rounded-full bg-success border-2 border-background" />
      </button>

      <HeaderDropdown
        open={open}
        onOpenChange={setOpen}
        title={t('nodeConnection')}
        width="sm"
        footer={
          <Link
            href="/settings#network"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline"
          >
            {tc('manageConnections')} →
          </Link>
        }
      >
        <div className="py-1">
          {connections.map((conn) => (
            <HeaderDropdownItem
              key={conn.id}
              icon={
                conn.isDocker ? (
                  <Container className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground" />
                )
              }
              title={conn.name}
              subtitle={conn.chain || undefined}
              active={conn.isActive}
              disabled={activating !== null}
              onClick={() => handleActivate(conn)}
              trailing={
                activating === conn.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : conn.isActive ? (
                  <Check className="h-4 w-4 text-success" />
                ) : null
              }
            />
          ))}
        </div>
      </HeaderDropdown>
    </div>
  );
}
