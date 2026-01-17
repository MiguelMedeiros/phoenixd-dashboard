'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  Box,
  Play,
  Square,
  RefreshCw,
  Settings,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Webhook,
  Key,
  FileText,
  ChevronDown,
  ChevronUp,
  Globe,
  Pause,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  getApps,
  installApp,
  startApp,
  stopApp,
  restartApp,
  uninstallApp,
  getAppLogs,
  getAppWebhooks,
  regenerateAppKey,
  regenerateAppSecret,
  type App,
  type AppWebhookLog,
} from '@/lib/api';
import { AppInstallDialog } from '@/components/app-install-dialog';
import { AppConfigDialog } from '@/components/app-config-dialog';
import { StatCard, StatCardGrid } from '@/components/stat-card';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { getWsUrl } from '@/hooks/use-dynamic-urls';

interface LogLine {
  timestamp: string;
  message: string;
}

export default function AppsPage() {
  const t = useTranslations('apps');
  const tc = useTranslations('common');
  const { toast } = useToast();

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [configApp, setConfigApp] = useState<App | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [appLogs, setAppLogs] = useState<Record<string, LogLine[]>>({});
  const [appWebhooks, setAppWebhooks] = useState<Record<string, AppWebhookLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);
  const [loadingWebhooks, setLoadingWebhooks] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logsConnected, setLogsConnected] = useState(false);
  const [logsPaused, setLogsPaused] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const webhookIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep pausedRef in sync
  useEffect(() => {
    pausedRef.current = logsPaused;
  }, [logsPaused]);

  // Parse log line
  const parseLogLine = useCallback((data: string): LogLine[] => {
    const lines: LogLine[] = [];
    const rawLines = data.split('\n').filter((line) => line.trim());

    for (const line of rawLines) {
      const timestampMatch = line.match(
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*(.*)/
      );

      if (timestampMatch) {
        const [, timestamp, message] = timestampMatch;
        lines.push({
          timestamp: new Date(timestamp).toLocaleTimeString(),
          message: message || '',
        });
      } else {
        lines.push({
          timestamp: new Date().toLocaleTimeString(),
          message: line,
        });
      }
    }

    return lines;
  }, []);

  // Connect to container logs via WebSocket
  const connectToLogs = useCallback(
    (containerName: string, appId: string) => {
      if (!containerName) return;

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setLogsConnected(false);
      setAppLogs((prev) => ({ ...prev, [appId]: [] }));

      const wsUrl = getWsUrl();
      const url = `${wsUrl}/ws/docker/logs/${containerName}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setLogsConnected(true);
        };

        ws.onmessage = (event) => {
          if (pausedRef.current) return;

          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log' && data.data) {
              const newLines = parseLogLine(data.data);
              setAppLogs((prev) => ({
                ...prev,
                [appId]: [...(prev[appId] || []), ...newLines].slice(-500),
              }));
            }
          } catch {
            const newLines = parseLogLine(event.data);
            setAppLogs((prev) => ({
              ...prev,
              [appId]: [...(prev[appId] || []), ...newLines].slice(-500),
            }));
          }
        };

        ws.onerror = () => {
          setLogsConnected(false);
        };

        ws.onclose = () => {
          setLogsConnected(false);
        };
      } catch (err) {
        console.error('WebSocket error:', err);
      }
    },
    [parseLogLine]
  );

  // Auto-scroll logs
  useEffect(() => {
    if (!logsPaused && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [appLogs, logsPaused]);

  const fetchApps = useCallback(async () => {
    try {
      const data = await getApps();
      setApps(data);
    } catch (error) {
      console.error('Failed to load apps:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: 'Failed to load apps',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tc]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleInstall = async (data: {
    name: string;
    sourceType: string;
    sourceUrl: string;
    description?: string;
    webhookEvents?: string[];
    envVars?: Record<string, string>;
  }) => {
    try {
      await installApp(data);
      toast({ title: tc('success'), description: t('appInstalled') });
      setShowInstallDialog(false);
      await fetchApps();
    } catch (error) {
      console.error('Failed to install app:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  const handleStart = async (appId: string) => {
    setActionLoading(appId);
    try {
      await startApp(appId);
      toast({ title: tc('success'), description: t('appStarted') });
      await fetchApps();
    } catch (error) {
      console.error('Failed to start app:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (appId: string) => {
    setActionLoading(appId);
    try {
      await stopApp(appId);
      toast({ title: tc('success'), description: t('appStopped') });
      await fetchApps();
    } catch (error) {
      console.error('Failed to stop app:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (appId: string) => {
    setActionLoading(appId);
    try {
      await restartApp(appId);
      toast({ title: tc('success'), description: t('appRestarted') });
      await fetchApps();
    } catch (error) {
      console.error('Failed to restart app:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (app: App) => {
    if (!confirm(t('confirmUninstall', { name: app.name }))) return;

    setActionLoading(app.id);
    try {
      await uninstallApp(app.id);
      toast({ title: tc('success'), description: t('appUninstalled') });
      setExpandedApp(null);
      await fetchApps();
    } catch (error) {
      console.error('Failed to uninstall app:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerateKey = async (appId: string) => {
    if (!confirm(t('confirmRegenerateKey'))) return;

    try {
      const result = await regenerateAppKey(appId);
      toast({
        title: tc('success'),
        description: t('keyRegenerated'),
      });
      // Show the new key
      alert(`${t('newApiKey')}: ${result.apiKey}`);
      await fetchApps();
    } catch (error) {
      console.error('Failed to regenerate key:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  const handleRegenerateSecret = async (appId: string) => {
    if (!confirm(t('confirmRegenerateSecret'))) return;

    try {
      const result = await regenerateAppSecret(appId);
      toast({
        title: tc('success'),
        description: t('secretRegenerated'),
      });
      // Show the new secret
      alert(`${t('newWebhookSecret')}: ${result.webhookSecret}`);
      await fetchApps();
    } catch (error) {
      console.error('Failed to regenerate secret:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  const loadAppLogs = async (appId: string) => {
    setLoadingLogs(appId);
    try {
      const result = await getAppLogs(appId);
      const lines = parseLogLine(result.logs);
      setAppLogs((prev) => ({ ...prev, [appId]: lines }));
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoadingLogs(null);
    }
  };

  const loadAppWebhooks = async (appId: string) => {
    setLoadingWebhooks(appId);
    try {
      const webhooks = await getAppWebhooks(appId);
      setAppWebhooks((prev) => ({ ...prev, [appId]: webhooks }));
    } catch (error) {
      console.error('Failed to load webhooks:', error);
    } finally {
      setLoadingWebhooks(null);
    }
  };

  const toggleExpand = (appId: string) => {
    if (expandedApp === appId) {
      // Closing - cleanup WebSocket and interval
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (webhookIntervalRef.current) {
        clearInterval(webhookIntervalRef.current);
        webhookIntervalRef.current = null;
      }
      setLogsConnected(false);
      setLogsPaused(false);
      setExpandedApp(null);
    } else {
      // Opening - connect to logs and start webhook polling
      const app = apps.find((a) => a.id === appId);
      setExpandedApp(appId);
      setLogsPaused(false);

      // Connect to WebSocket for live logs if app is running
      if (app?.containerName && app.containerStatus === 'running') {
        connectToLogs(app.containerName, appId);
      } else {
        // Load static logs if not running
        loadAppLogs(appId);
      }

      // Load webhooks initially
      loadAppWebhooks(appId);

      // Start polling webhooks every 5 seconds
      webhookIntervalRef.current = setInterval(() => {
        loadAppWebhooks(appId);
      }, 5000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (webhookIntervalRef.current) {
        clearInterval(webhookIntervalRef.current);
      }
    };
  }, []);

  // Filter apps by search
  const filteredApps = apps.filter((app) => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return (
      app.name.toLowerCase().includes(lower) ||
      app.slug.toLowerCase().includes(lower) ||
      app.description?.toLowerCase().includes(lower)
    );
  });

  // Stats
  const runningApps = apps.filter((a) => a.containerStatus === 'running').length;
  const stoppedApps = apps.filter((a) => a.containerStatus === 'stopped').length;
  const errorApps = apps.filter(
    (a) => a.containerStatus === 'error' || a.healthStatus === 'unhealthy'
  ).length;

  const getStatusIcon = (app: App) => {
    if (app.containerStatus === 'running') {
      if (app.healthStatus === 'healthy') {
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      } else if (app.healthStatus === 'unhealthy') {
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      }
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    if (app.containerStatus === 'error') {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <Square className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusLabel = (app: App) => {
    if (app.containerStatus === 'running') {
      if (app.healthStatus === 'healthy') return t('statusHealthy');
      if (app.healthStatus === 'unhealthy') return t('statusUnhealthy');
      return t('statusRunning');
    }
    if (app.containerStatus === 'error') return t('statusError');
    return t('statusStopped');
  };

  if (loading) {
    return (
      <div className="space-y-4 pt-4 md:pt-6">
        <div className="h-8 w-32 bg-white/5 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 w-full rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-4 md:pt-6 space-y-4">
        {/* Header */}
        <PageHeader title={t('title')} subtitle={t('subtitle')}>
          <button
            onClick={() => setShowInstallDialog(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('installApp')}</span>
          </button>
        </PageHeader>

        {/* Stats */}
        {apps.length > 0 && (
          <StatCardGrid columns={3}>
            <StatCard label={t('running')} value={runningApps} icon={Play} variant="success" />
            <StatCard label={t('stopped')} value={stoppedApps} icon={Square} variant="muted" />
            <StatCard label={t('errors')} value={errorApps} icon={AlertCircle} variant="error" />
          </StatCardGrid>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('searchApps')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
        </div>

        {/* Apps List */}
        <div>
          {filteredApps.length === 0 ? (
            <div className="py-12 text-center">
              <Box className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">{search ? t('noResults') : t('noApps')}</p>
              {!search && (
                <button
                  onClick={() => setShowInstallDialog(true)}
                  className="mt-3 text-primary text-sm hover:underline"
                >
                  + {t('installApp')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredApps.map((app) => {
                const isExpanded = expandedApp === app.id;
                return (
                  <div
                    key={app.id}
                    className={cn(
                      'rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] hover:from-white/[0.06] hover:to-white/[0.03] hover:border-white/15 transition-all overflow-hidden',
                      isExpanded && 'ring-1 ring-primary/30 border-primary/30'
                    )}
                  >
                    {/* App Header */}
                    <button
                      onClick={() => toggleExpand(app.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left group hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Icon */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 shrink-0">
                        {app.icon ? (
                          <span className="text-lg">{app.icon}</span>
                        ) : (
                          <Box className="h-5 w-5 text-primary" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{app.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-mono">
                            {app.slug}
                          </span>
                        </div>
                        {app.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {app.description}
                          </p>
                        )}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(app)}
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {getStatusLabel(app)}
                          </span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {app.containerStatus === 'running' && (
                          <a
                            href={`/api/apps/open/${app.slug}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-primary"
                            title={t('openApp')}
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        )}
                        {app.containerStatus === 'running' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStop(app.id);
                            }}
                            disabled={actionLoading === app.id}
                            className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                            title={t('stop')}
                          >
                            {actionLoading === app.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStart(app.id);
                            }}
                            disabled={actionLoading === app.id || !app.isEnabled}
                            className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-success"
                            title={t('start')}
                          >
                            {actionLoading === app.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfigApp(app);
                          }}
                          className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                          title={t('configure')}
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Expand Arrow */}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {app.containerStatus === 'running' && (
                            <a
                              href={`/api/apps/open/${app.slug}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors"
                            >
                              <Globe className="h-3.5 w-3.5" />
                              {t('openApp')}
                            </a>
                          )}
                          {app.containerStatus === 'running' ? (
                            <>
                              <button
                                onClick={() => handleRestart(app.id)}
                                disabled={actionLoading === app.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                {t('restart')}
                              </button>
                              <button
                                onClick={() => handleStop(app.id)}
                                disabled={actionLoading === app.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                              >
                                <Square className="h-3.5 w-3.5" />
                                {t('stop')}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStart(app.id)}
                              disabled={actionLoading === app.id || !app.isEnabled}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 text-xs font-medium transition-colors"
                            >
                              <Play className="h-3.5 w-3.5" />
                              {t('start')}
                            </button>
                          )}
                          <button
                            onClick={() => setConfigApp(app)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            {t('configure')}
                          </button>
                          <button
                            onClick={() => handleUninstall(app)}
                            disabled={actionLoading === app.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t('uninstall')}
                          </button>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Source */}
                          <div className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.06]">
                            <div className="flex items-center gap-2 mb-1">
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">
                                {t('source')}
                              </span>
                            </div>
                            <p className="text-xs font-mono truncate" title={app.sourceUrl}>
                              {app.sourceUrl}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {app.sourceType}
                            </span>
                          </div>

                          {/* API Key */}
                          <div className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.06]">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t('apiKey')}
                                </span>
                              </div>
                              <button
                                onClick={() => handleRegenerateKey(app.id)}
                                className="text-[10px] text-primary hover:underline"
                              >
                                {t('regenerate')}
                              </button>
                            </div>
                            <p className="text-xs font-mono">{app.apiKey || '***'}</p>
                          </div>

                          {/* Webhook Secret */}
                          <div className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.06]">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <Webhook className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t('webhookSecret')}
                                </span>
                              </div>
                              <button
                                onClick={() => handleRegenerateSecret(app.id)}
                                className="text-[10px] text-primary hover:underline"
                              >
                                {t('regenerate')}
                              </button>
                            </div>
                            <p className="text-xs font-mono">{app.webhookSecret || '***'}</p>
                          </div>

                          {/* Webhook Events */}
                          <div className="rounded-lg p-3 bg-white/[0.03] border border-white/[0.06]">
                            <div className="flex items-center gap-2 mb-1">
                              <Webhook className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">
                                {t('webhookEvents')}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {app.webhookEvents ? (
                                JSON.parse(app.webhookEvents).map((event: string) => (
                                  <span
                                    key={event}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                                  >
                                    {event}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t('noEvents')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Logs */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {t('logs')}
                                </span>
                              </div>
                              {/* Live indicator */}
                              {app.containerStatus === 'running' && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                                  <div
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full transition-all',
                                      logsConnected
                                        ? logsPaused
                                          ? 'bg-yellow-500 shadow-[0_0_6px_hsl(45,93%,47%)]'
                                          : 'bg-green-500 shadow-[0_0_6px_hsl(142,76%,36%)] animate-pulse'
                                        : 'bg-red-500'
                                    )}
                                  />
                                  <span className="text-[10px] text-muted-foreground">
                                    {logsConnected
                                      ? logsPaused
                                        ? tc('paused')
                                        : 'Live'
                                      : tc('disconnected')}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Pause/Play button */}
                              {app.containerStatus === 'running' && logsConnected && (
                                <button
                                  onClick={() => setLogsPaused(!logsPaused)}
                                  className={cn(
                                    'text-[10px] flex items-center gap-1 px-2 py-0.5 rounded',
                                    logsPaused
                                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                  )}
                                >
                                  {logsPaused ? (
                                    <>
                                      <Play className="h-3 w-3" />
                                      {tc('resume')}
                                    </>
                                  ) : (
                                    <>
                                      <Pause className="h-3 w-3" />
                                      {tc('pause')}
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (app.containerName && app.containerStatus === 'running') {
                                    connectToLogs(app.containerName, app.id);
                                  } else {
                                    loadAppLogs(app.id);
                                  }
                                }}
                                disabled={loadingLogs === app.id}
                                className="text-[10px] text-primary hover:underline flex items-center gap-1"
                              >
                                {loadingLogs === app.id && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="rounded-lg overflow-hidden border border-white/[0.06]">
                            <div
                              ref={logsContainerRef}
                              className="max-h-48 overflow-y-auto bg-zinc-100 dark:bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed"
                            >
                              {loadingLogs === app.id ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : appLogs[app.id]?.length > 0 ? (
                                <div className="space-y-px">
                                  {appLogs[app.id].map((log, index) => (
                                    <div
                                      key={index}
                                      className="flex gap-3 py-0.5 px-2 -mx-2 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    >
                                      {log.timestamp && (
                                        <span className="text-muted-foreground flex-shrink-0 w-16 text-[10px] tabular-nums">
                                          {log.timestamp}
                                        </span>
                                      )}
                                      <span className="break-all whitespace-pre-wrap text-foreground">
                                        {log.message}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  {t('noLogs')}
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Log count footer */}
                          {appLogs[app.id]?.length > 0 && (
                            <div className="flex items-center justify-between mt-1 px-1">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {appLogs[app.id].length} {t('logLines')}
                              </span>
                              {logsPaused && (
                                <span className="text-[10px] text-yellow-500 flex items-center gap-1">
                                  <Pause className="h-2.5 w-2.5" />
                                  {tc('paused')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Recent Webhooks */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Webhook className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">
                                {t('recentWebhooks')}
                              </span>
                            </div>
                            <button
                              onClick={() => loadAppWebhooks(app.id)}
                              disabled={loadingWebhooks === app.id}
                              className="text-[10px] text-primary hover:underline flex items-center gap-1"
                            >
                              {loadingWebhooks === app.id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {t('refresh')}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {loadingWebhooks === app.id ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            ) : appWebhooks[app.id]?.length > 0 ? (
                              appWebhooks[app.id].slice(0, 5).map((webhook) => (
                                <div
                                  key={webhook.id}
                                  className="flex items-center gap-2 rounded-lg p-2 bg-white/[0.03] border border-white/[0.06]"
                                >
                                  {webhook.success ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                  )}
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 font-mono">
                                    {webhook.eventType}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground flex-1">
                                    {webhook.statusCode ? `${webhook.statusCode}` : 'N/A'}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(webhook.createdAt).toLocaleTimeString()}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                {t('noWebhooks')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Install Dialog */}
      <AppInstallDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
        onInstall={handleInstall}
      />

      {/* Config Dialog */}
      {configApp && (
        <AppConfigDialog
          open={!!configApp}
          onOpenChange={(open) => !open && setConfigApp(null)}
          app={configApp}
          onSave={async (_updates) => {
            // Update via API when implemented
            toast({ title: tc('success'), description: t('configSaved') });
            await fetchApps();
            setConfigApp(null);
          }}
        />
      )}
    </>
  );
}
