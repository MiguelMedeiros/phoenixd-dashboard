'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Settings, Plus, X, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type App, updateApp } from '@/lib/api';

interface AppConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: App;
  onSave: (updates: Partial<App>) => Promise<void>;
}

const WEBHOOK_EVENTS = [
  { id: 'payment_received', label: 'Payment Received' },
  { id: 'payment_sent', label: 'Payment Sent' },
  { id: 'channel_opened', label: 'Channel Opened' },
  { id: 'channel_closed', label: 'Channel Closed' },
];

const API_PERMISSIONS = [
  { id: 'read:balance', label: 'Read Balance' },
  { id: 'read:payments', label: 'Read Payments' },
  { id: 'read:channels', label: 'Read Channels' },
  { id: 'read:node', label: 'Read Node Info' },
  { id: 'write:invoices', label: 'Create Invoices' },
  { id: 'write:payments', label: 'Send Payments' },
];

export function AppConfigDialog({ open, onOpenChange, app, onSave }: AppConfigDialogProps) {
  const t = useTranslations('apps');
  const tc = useTranslations('common');

  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description || '');
  const [webhookPath, setWebhookPath] = useState(app.webhookPath || '/webhook');
  const [internalPort, setInternalPort] = useState(app.internalPort?.toString() || '3000');
  const [isEnabled, setIsEnabled] = useState(app.isEnabled);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with app data
  useEffect(() => {
    setName(app.name);
    setDescription(app.description || '');
    setWebhookPath(app.webhookPath || '/webhook');
    setInternalPort(app.internalPort?.toString() || '3000');
    setIsEnabled(app.isEnabled);

    // Parse webhook events
    try {
      const events = app.webhookEvents ? JSON.parse(app.webhookEvents) : [];
      setSelectedEvents(events);
    } catch {
      setSelectedEvents([]);
    }

    // Parse API permissions
    try {
      const perms = app.apiPermissions ? JSON.parse(app.apiPermissions) : [];
      setSelectedPermissions(perms);
    } catch {
      setSelectedPermissions([]);
    }

    // Parse env vars
    try {
      const vars = app.envVars ? JSON.parse(app.envVars) : {};
      setEnvVars(Object.entries(vars).map(([key, value]) => ({ key, value: value as string })));
    } catch {
      setEnvVars([]);
    }
  }, [app]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('nameRequired'));
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

      await updateApp(app.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        webhookPath: webhookPath.trim() || '/webhook',
        internalPort: parseInt(internalPort) || 3000,
        isEnabled,
        webhookEvents: selectedEvents,
        apiPermissions: selectedPermissions,
        envVars: envVarsObj,
      });

      await onSave({});
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

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            {t('configureApp')}: {app.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          {/* Enabled Toggle */}
          <div className="flex items-center justify-between rounded-lg p-3 bg-white/[0.03] border border-white/[0.06]">
            <div>
              <span className="text-sm font-medium">{t('enabled')}</span>
              <p className="text-xs text-muted-foreground">{t('enabledDescription')}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                isEnabled ? 'bg-primary' : 'bg-white/10'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  isEnabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              {t('appName')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
            />
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
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
            />
          </div>

          {/* Webhook Path */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              {t('webhookPath')}
            </label>
            <input
              type="text"
              value={webhookPath}
              onChange={(e) => setWebhookPath(e.target.value)}
              placeholder="/webhook"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{t('webhookPathDescription')}</p>
          </div>

          {/* Internal Port */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              {t('internalPort')}
            </label>
            <input
              type="number"
              value={internalPort}
              onChange={(e) => setInternalPort(e.target.value)}
              placeholder="3000"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{t('internalPortDescription')}</p>
          </div>

          {/* Webhook Events */}
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

          {/* API Permissions */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              {t('apiPermissions')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {API_PERMISSIONS.map((perm) => (
                <button
                  key={perm.id}
                  type="button"
                  onClick={() => togglePermission(perm.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                    selectedPermissions.includes(perm.id)
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent'
                  )}
                >
                  {perm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Environment Variables */}
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
                  <Save className="h-4 w-4" />
                  {tc('save')}
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
