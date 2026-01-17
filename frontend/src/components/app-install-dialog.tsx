'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Github, Package, Plus, X, Heart, Bell, Zap, Store, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface AppInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (data: {
    name: string;
    sourceType: string;
    sourceUrl: string;
    description?: string;
    webhookEvents?: string[];
    envVars?: Record<string, string>;
    apiPermissions?: string[];
  }) => Promise<void>;
}

const WEBHOOK_EVENTS = [
  { id: 'payment_received', label: 'Payment Received' },
  { id: 'payment_sent', label: 'Payment Sent' },
  { id: 'channel_opened', label: 'Channel Opened' },
  { id: 'channel_closed', label: 'Channel Closed' },
];

// Pre-configured apps in the marketplace
interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  sourceType: string;
  sourceUrl: string;
  webhookEvents: string[];
  apiPermissions: string[];
  envVars: { key: string; value: string; description: string; required: boolean }[];
  featured?: boolean;
}

const MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: 'donations',
    name: 'Donations Page',
    description: 'Beautiful donation page to accept Lightning payments with customizable branding',
    icon: <Heart className="h-5 w-5" />,
    sourceType: 'docker_image',
    // Use local image - will be published to ghcr.io for production
    sourceUrl: 'phoenixd-donations:latest',
    webhookEvents: ['payment_received'],
    apiPermissions: ['write:invoices', 'read:node'],
    envVars: [
      { key: 'DONATIONS_TITLE', value: '', description: 'Page title', required: false },
      { key: 'DONATIONS_SUBTITLE', value: '', description: 'Page subtitle', required: false },
      { key: 'DONATIONS_LOGO', value: '', description: 'Logo URL', required: false },
      { key: 'DONATIONS_THEME', value: 'dark', description: 'Theme (dark/light)', required: false },
      {
        key: 'DONATIONS_AMOUNTS',
        value: '1000,5000,10000,50000',
        description: 'Suggested amounts in sats',
        required: false,
      },
    ],
    featured: true,
  },
  {
    id: 'telegram-notify',
    name: 'Telegram Notifications',
    description: 'Get instant Telegram notifications when you receive payments',
    icon: <Bell className="h-5 w-5" />,
    sourceType: 'docker_image',
    sourceUrl: 'ghcr.io/phoenixd-dashboard/telegram-notify:latest',
    webhookEvents: ['payment_received', 'payment_sent'],
    apiPermissions: ['read:payments'],
    envVars: [
      {
        key: 'TELEGRAM_BOT_TOKEN',
        value: '',
        description: 'Your Telegram bot token',
        required: true,
      },
      {
        key: 'TELEGRAM_CHAT_ID',
        value: '',
        description: 'Chat ID to send messages to',
        required: true,
      },
    ],
    featured: false,
  },
  {
    id: 'nostr-zapper',
    name: 'Nostr Zapper',
    description: 'Automatically process Nostr zaps and send notifications',
    icon: <Zap className="h-5 w-5" />,
    sourceType: 'docker_image',
    sourceUrl: 'ghcr.io/phoenixd-dashboard/nostr-zapper:latest',
    webhookEvents: ['payment_received'],
    apiPermissions: ['read:payments', 'read:node'],
    envVars: [
      {
        key: 'NOSTR_PRIVATE_KEY',
        value: '',
        description: 'Nostr private key (nsec)',
        required: true,
      },
      {
        key: 'NOSTR_RELAYS',
        value: 'wss://relay.damus.io,wss://nos.lol',
        description: 'Comma-separated relay URLs',
        required: false,
      },
    ],
    featured: false,
  },
];

type SourceType = 'docker_image' | 'github' | 'marketplace';

export function AppInstallDialog({ open, onOpenChange, onInstall }: AppInstallDialogProps) {
  const t = useTranslations('apps');
  const tc = useTranslations('common');

  const [sourceType, setSourceType] = useState<SourceType>('marketplace');
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarketplaceApp, setSelectedMarketplaceApp] = useState<MarketplaceApp | null>(
    MARKETPLACE_APPS.find((app) => app.featured) || null
  );

  const resetForm = () => {
    setName('');
    setSourceUrl('');
    setDescription('');
    setSelectedEvents([]);
    setSelectedPermissions([]);
    setEnvVars([]);
    setError(null);
    setSelectedMarketplaceApp(MARKETPLACE_APPS.find((app) => app.featured) || null);
  };

  const selectMarketplaceApp = (app: MarketplaceApp) => {
    setSelectedMarketplaceApp(app);
    setName(app.name);
    setSourceUrl(app.sourceUrl);
    setDescription(app.description);
    setSelectedEvents(app.webhookEvents);
    setSelectedPermissions(app.apiPermissions);
    setEnvVars(app.envVars.map((v) => ({ key: v.key, value: v.value })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // For marketplace apps, use the selected app data
    const finalName =
      sourceType === 'marketplace' && selectedMarketplaceApp ? selectedMarketplaceApp.name : name;
    const finalSourceUrl =
      sourceType === 'marketplace' && selectedMarketplaceApp
        ? selectedMarketplaceApp.sourceUrl
        : sourceUrl;
    const finalSourceType = sourceType === 'marketplace' ? 'docker_image' : sourceType;

    if (!finalName.trim()) {
      setError(t('nameRequired'));
      return;
    }
    if (!finalSourceUrl.trim()) {
      setError(t('sourceUrlRequired'));
      return;
    }

    setLoading(true);
    try {
      const envVarsObj: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key.trim()) {
          envVarsObj[key.trim()] = value;
        }
      });

      await onInstall({
        name: finalName.trim(),
        sourceType: finalSourceType,
        sourceUrl: finalSourceUrl.trim(),
        description: description.trim() || undefined,
        webhookEvents: selectedEvents.length > 0 ? selectedEvents : undefined,
        envVars: Object.keys(envVarsObj).length > 0 ? envVarsObj : undefined,
        apiPermissions: selectedPermissions.length > 0 ? selectedPermissions : undefined,
      });

      resetForm();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const addEnvVar = () => {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    setEnvVars((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const removeEnvVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            {t('installApp')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Source Type Tabs */}
          <div className="flex rounded-lg border border-white/10 p-1 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setSourceType('marketplace')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                sourceType === 'marketplace'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <Store className="h-4 w-4" />
              {t('appStore')}
            </button>
            <button
              type="button"
              onClick={() => setSourceType('docker_image')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                sourceType === 'docker_image'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <Package className="h-4 w-4" />
              Docker
            </button>
            <button
              type="button"
              onClick={() => setSourceType('github')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                sourceType === 'github'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <Github className="h-4 w-4" />
              GitHub
            </button>
          </div>

          {/* Marketplace Apps */}
          {sourceType === 'marketplace' && (
            <div className="space-y-3">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block">
                {t('selectApp')}
              </label>
              <div className="grid gap-2">
                {MARKETPLACE_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => selectMarketplaceApp(app)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all',
                      selectedMarketplaceApp?.id === app.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
                          selectedMarketplaceApp?.id === app.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-white/10 text-muted-foreground'
                        )}
                      >
                        {app.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{app.name}</span>
                          {app.featured && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                              {t('featured')}
                            </span>
                          )}
                          {selectedMarketplaceApp?.id === app.id && (
                            <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {app.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Marketplace app configuration */}
              {selectedMarketplaceApp && selectedMarketplaceApp.envVars.length > 0 && (
                <div className="pt-2 space-y-3">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block">
                    {t('appConfiguration')}
                  </label>
                  {selectedMarketplaceApp.envVars.map((envVar, index) => (
                    <div key={envVar.key}>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {envVar.description}
                        {envVar.required && <span className="text-destructive ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={envVars.find((v) => v.key === envVar.key)?.value || ''}
                        onChange={(e) => {
                          setEnvVars((prev) =>
                            prev.map((v, i) => (i === index ? { ...v, value: e.target.value } : v))
                          );
                        }}
                        placeholder={envVar.key}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual installation fields */}
          {sourceType !== 'marketplace' && (
            <>
              {/* Name */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                  {t('appName')} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('appNamePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
                />
              </div>

              {/* Source URL */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                  {sourceType === 'docker_image' ? t('dockerImage') : t('githubRepo')} *
                </label>
                <input
                  type="text"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={
                    sourceType === 'docker_image'
                      ? 'myregistry/myapp:latest'
                      : 'https://github.com/user/repo'
                  }
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
                />
                {sourceType === 'github' && (
                  <p className="text-[10px] text-muted-foreground mt-1">{t('githubNote')}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                  {t('description')}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
                />
              </div>
            </>
          )}

          {/* Webhook Events - only for manual installation */}
          {sourceType !== 'marketplace' && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                {t('webhookEvents')}
              </label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => toggleEvent(event.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      selectedEvents.includes(event.id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    )}
                  >
                    {event.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Environment Variables - only for manual installation */}
          {sourceType !== 'marketplace' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('envVars')}
                </label>
                <button
                  type="button"
                  onClick={addEnvVar}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  {t('addEnvVar')}
                </button>
              </div>
              {envVars.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t('noEnvVars')}</p>
              ) : (
                <div className="space-y-2">
                  {envVars.map((envVar, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={envVar.key}
                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                        placeholder="KEY"
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <input
                        type="text"
                        value={envVar.value}
                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                        placeholder="value"
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvVar(index)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Auto-injected Env Vars Info */}
          <div className="rounded-lg p-3 bg-primary/5 border border-primary/20">
            <p className="text-xs text-primary font-medium mb-1">{t('autoInjectedVars')}</p>
            <ul className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
              <li>PHOENIXD_DASHBOARD_URL</li>
              <li>PHOENIXD_APP_API_KEY</li>
              <li>PHOENIXD_WEBHOOK_SECRET</li>
              <li>PHOENIXD_NODE_ID</li>
              <li>PHOENIXD_CHAIN</li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {t('install')}
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
