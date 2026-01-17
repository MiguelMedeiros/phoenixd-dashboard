'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Server,
  ScrollText,
  Terminal as TerminalIcon,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Layers,
  BookOpen,
  Github,
  ExternalLink,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { cn } from '@/lib/utils';
import { getNodeInfo, getContainers, ContainerInfo } from '@/lib/api';
import { getWsUrl } from '@/hooks/use-dynamic-urls';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { PageHeader } from '@/components/page-header';
import { PageTabs, type TabItem } from '@/components/ui/page-tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from 'next-intl';

interface LogLine {
  timestamp: string;
  message: string;
  stream: 'stdout' | 'stderr';
}

interface NodeInfoData {
  nodeId: string;
  chain: string;
  version: string;
  channels?: { channelId: string }[];
}

export default function NodePage() {
  const t = useTranslations('node');
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Determine active tab from URL or default to 'info'
  const [activeTab, setActiveTab] = useState<'info' | 'logs' | 'terminal'>(
    (tabParam as 'info' | 'logs' | 'terminal') || 'info'
  );

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'info' | 'logs' | 'terminal');
    router.push(`/node?tab=${tab}`, { scroll: false });
  };

  const tabs: TabItem[] = [
    { id: 'info', label: t('info'), icon: Server },
    { id: 'logs', label: t('logs'), icon: ScrollText },
    { id: 'terminal', label: t('terminal'), icon: TerminalIcon },
  ];

  return (
    <div className="pt-4 md:pt-6 space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Tab Switcher */}
      <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Node Info Tab */}
      {activeTab === 'info' && <NodeInfoTab />}

      {/* Logs Tab */}
      {activeTab === 'logs' && <LogsTab />}

      {/* Terminal Tab */}
      {activeTab === 'terminal' && <TerminalTab />}
    </div>
  );
}

// ============= NODE INFO TAB =============
function NodeInfoTab() {
  const t = useTranslations('node');
  const tc = useTranslations('common');
  const [nodeInfo, setNodeInfo] = useState<NodeInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { copied: nodeIdCopied, copy: copyNodeId } = useCopyToClipboard();

  // External links
  const externalLinks = [
    {
      title: tc('phoenixdDocs'),
      href: 'https://phoenix.acinq.co/server/api',
      icon: BookOpen,
    },
    {
      title: tc('phoenixd'),
      href: 'https://github.com/ACINQ/phoenixd',
      icon: Github,
    },
    {
      title: tc('dashboard'),
      href: 'https://github.com/MiguelMedeiros/phoenixd-dashboard',
      icon: Github,
    },
  ];

  const fetchNodeInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getNodeInfo();
      setNodeInfo(data);
    } catch (err) {
      console.error('Failed to fetch node info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load node info');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNodeInfo();
  }, [fetchNodeInfo]);

  // Listen for phoenixd connection changes
  useEffect(() => {
    const handleConnectionChange = () => {
      console.log('Phoenixd connection changed, refreshing node info...');
      setTimeout(fetchNodeInfo, 1500);
    };

    window.addEventListener('phoenixd:connection-changed', handleConnectionChange);
    return () => window.removeEventListener('phoenixd:connection-changed', handleConnectionChange);
  }, [fetchNodeInfo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-3xl p-8 text-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Node ID Card */}
      <div className="glass-card rounded-3xl p-6 lg:col-span-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t('nodeId')}</h3>
            <p className="text-sm text-muted-foreground">{t('nodeIdDescription')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-black/5 dark:bg-white/5">
          <code className="flex-1 font-mono text-sm break-all select-all">{nodeInfo?.nodeId}</code>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => nodeInfo?.nodeId && copyNodeId(nodeInfo.nodeId)}
            className="flex-shrink-0"
          >
            {nodeIdCopied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Network Card */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lightning/10">
            <Layers className="h-6 w-6 text-lightning" />
          </div>
          <div>
            <h3 className="font-semibold">{t('network')}</h3>
            <p className="text-sm text-muted-foreground">{t('networkDescription')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
            <span className="text-sm text-muted-foreground">{t('chain')}</span>
            <span
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                nodeInfo?.chain === 'mainnet'
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning'
              )}
            >
              {nodeInfo?.chain}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
            <span className="text-sm text-muted-foreground">{t('version')}</span>
            <span className="font-mono text-sm">{nodeInfo?.version}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5">
            <span className="text-sm text-muted-foreground">{t('channels')}</span>
            <span className="font-mono text-sm">{nodeInfo?.channels?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
            <TerminalIcon className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold">{t('quickActions')}</h3>
            <p className="text-sm text-muted-foreground">{t('quickActionsDescription')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => (window.location.href = '/node?tab=logs')}
            className="w-full text-left flex items-center gap-3 p-4 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ScrollText className="h-5 w-5 text-blue-400" />
            <div>
              <p className="font-medium">{t('viewLogs')}</p>
              <p className="text-xs text-muted-foreground">{t('viewLogsDescription')}</p>
            </div>
          </button>

          <button
            onClick={() => (window.location.href = '/node?tab=terminal')}
            className="w-full text-left flex items-center gap-3 p-4 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <TerminalIcon className="h-5 w-5 text-green-400" />
            <div>
              <p className="font-medium">{t('openTerminal')}</p>
              <p className="text-xs text-muted-foreground">{t('openTerminalDescription')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* External Resources Card */}
      <div className="glass-card rounded-3xl p-6 lg:col-span-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
            <ExternalLink className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold">{t('resources')}</h3>
            <p className="text-sm text-muted-foreground">{t('resourcesDescription')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {externalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors group"
            >
              <link.icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center">
                {link.title}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============= LOGS TAB =============
function LogsTab() {
  const tc = useTranslations('common');
  const td = useTranslations('docker');
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pausedRef = useRef(false);

  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep pausedRef in sync with paused state
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

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
          stream: 'stdout',
        });
      } else {
        lines.push({
          timestamp: new Date().toLocaleTimeString(),
          message: line,
          stream: 'stdout',
        });
      }
    }

    return lines;
  }, []);

  // Connect to container logs
  const connectToLogs = useCallback(
    (containerName: string) => {
      if (!containerName) return;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnected(false);
      setError(null);
      setLogs([]);

      const wsUrl = getWsUrl();
      const url = `${wsUrl}/ws/docker/logs/${containerName}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
        };

        ws.onmessage = (event) => {
          if (pausedRef.current) return;

          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log' && data.data) {
              const newLines = parseLogLine(data.data);
              setLogs((prev) => [...prev, ...newLines].slice(-1000));
            } else if (data.type === 'error') {
              setError(data.message);
            } else if (data.type === 'end') {
              setLogs((prev) => [
                ...prev,
                {
                  timestamp: new Date().toLocaleTimeString(),
                  message: 'Log stream ended',
                  stream: 'stderr',
                },
              ]);
              setConnected(false);
            }
          } catch {
            const newLines = parseLogLine(event.data);
            setLogs((prev) => [...prev, ...newLines].slice(-1000));
          }
        };

        ws.onerror = () => {
          setError(td('connectionError'));
          setConnected(false);
        };

        ws.onclose = () => {
          setConnected(false);
        };
      } catch (err) {
        console.error('WebSocket error:', err);
        setError(td('failedToConnect'));
      }
    },
    [parseLogLine, td]
  );

  // Fetch containers
  const fetchContainers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getContainers();
      setContainers(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch containers:', err);
      setError(td('failedToLoadContainers'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [td]);

  // Auto-scroll
  useEffect(() => {
    if (!paused && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, paused]);

  // Initialize
  useEffect(() => {
    fetchContainers().then((data) => {
      if (data.length > 0) {
        const running = data.find((c) => c.state === 'running');
        const containerToSelect = running?.name || data[0].name;
        setSelectedContainer(containerToSelect);
        connectToLogs(containerToSelect);
      }
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContainerChange = (value: string) => {
    setSelectedContainer(value);
    connectToLogs(value);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleReconnect = () => {
    if (selectedContainer) {
      connectToLogs(selectedContainer);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
          {/* Container Selector */}
          <Select
            value={selectedContainer}
            onValueChange={handleContainerChange}
            disabled={loading}
          >
            <SelectTrigger className="w-full sm:w-[240px] h-10 bg-black/20 border-white/10 rounded-xl">
              <SelectValue placeholder={loading ? tc('loading') : td('selectContainer')} />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
              {containers.length === 0 && !loading && (
                <SelectItem value="none" disabled>
                  {td('noContainers')}
                </SelectItem>
              )}
              {containers.map((container) => (
                <SelectItem key={container.id} value={container.name}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        container.state === 'running'
                          ? 'bg-green-500'
                          : container.state === 'exited'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                      )}
                    />
                    <span>{container.name.replace('phoenixd-dashboard-', '')}</span>
                    <span className="text-muted-foreground text-xs">({container.state})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
            <div
              className={cn(
                'h-2 w-2 rounded-full transition-all',
                connected
                  ? paused
                    ? 'bg-yellow-500 shadow-[0_0_8px_hsl(45,93%,47%)]'
                    : 'bg-green-500 shadow-[0_0_8px_hsl(142,76%,36%)]'
                  : 'bg-red-500 shadow-[0_0_8px_hsl(0,72%,51%)]'
              )}
            />
            <span className="text-xs font-medium">
              {connected ? (paused ? td('paused') : tc('connected')) : tc('disconnected')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Pause/Resume */}
          <Button
            variant={paused ? 'lightning' : 'outline'}
            size="sm"
            onClick={() => setPaused(!paused)}
            className="h-9 px-3 rounded-xl flex-1 sm:flex-none"
          >
            {paused ? (
              <>
                <Play className="h-4 w-4 lg:mr-2" />
                <span className="hidden lg:inline">{td('resume')}</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 lg:mr-2" />
                <span className="hidden lg:inline">{td('pause')}</span>
              </>
            )}
          </Button>

          {/* Clear */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
            className="h-9 px-3 rounded-xl flex-1 sm:flex-none"
          >
            <Trash2 className="h-4 w-4 lg:mr-2" />
            <span className="hidden lg:inline">{td('clearLogs')}</span>
          </Button>

          {/* Reconnect */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconnect}
            disabled={!selectedContainer || loading}
            className="h-9 px-3 rounded-xl"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Logs Container */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div
          ref={logsContainerRef}
          className="h-[500px] overflow-auto bg-zinc-100 dark:bg-[#0a0a0a] p-4 font-mono text-[13px] leading-relaxed"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <ScrollText className="h-12 w-12 opacity-20" />
              <p>{td('noLogs')}</p>
            </div>
          ) : (
            <div className="space-y-px">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex gap-4 py-1 px-2 -mx-2 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors',
                    log.stream === 'stderr' && 'text-red-600 dark:text-red-400'
                  )}
                >
                  <span className="text-muted-foreground/70 flex-shrink-0 w-20 text-xs tabular-nums">
                    {log.timestamp}
                  </span>
                  <span className="break-all whitespace-pre-wrap text-zinc-800 dark:text-foreground/90">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {error && (
          <div className="px-4 py-3 border-t border-red-500/20 bg-red-500/10">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {error}
            </p>
          </div>
        )}

        <div className="px-4 py-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <span className="text-sm text-muted-foreground tabular-nums">
            {logs.length.toLocaleString()} {td('logLines')}
          </span>
          {paused && (
            <span className="text-sm text-yellow-600 dark:text-yellow-500 flex items-center gap-2">
              <Pause className="h-3 w-3" />
              {td('pausedHint')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= TERMINAL TAB =============
function TerminalTab() {
  const tc = useTranslations('common');
  const td = useTranslations('docker');
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch containers
  const fetchContainers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getContainers();
      const runningContainers = data.filter((c) => c.state === 'running');
      setContainers(runningContainers);
      return runningContainers;
    } catch (err) {
      console.error('Failed to fetch containers:', err);
      setError(td('failedToLoadContainers'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [td]);

  // Connect to container
  const connectToContainer = useCallback(
    (containerName: string) => {
      if (!containerName || !terminalInstance.current) return;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnected(false);
      setError(null);

      const term = terminalInstance.current;
      term.clear();
      term.writeln(`\x1b[33m${td('connectingTo')} ${containerName}...\x1b[0m`);

      const wsUrl = getWsUrl();
      const url = `${wsUrl}/ws/docker/exec/${containerName}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          term.clear();
          term.writeln(`\x1b[32m${td('connectedTo')} ${containerName}\x1b[0m`);
          term.writeln('');
          term.focus();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'output') {
              term.write(data.data);
            } else if (data.type === 'error') {
              term.writeln(`\x1b[31m${td('error')}: ${data.message}\x1b[0m`);
              setError(data.message);
            } else if (data.type === 'end') {
              term.writeln('');
              term.writeln(`\x1b[33m${td('connectionClosed')}\x1b[0m`);
              setConnected(false);
            }
          } catch {
            term.write(event.data);
          }
        };

        ws.onerror = () => {
          term.writeln(`\x1b[31m${td('connectionError')}\x1b[0m`);
          setError(td('connectionError'));
          setConnected(false);
        };

        ws.onclose = () => {
          setConnected(false);
        };

        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });
      } catch (err) {
        console.error('WebSocket error:', err);
        setError(td('failedToConnect'));
      }
    },
    [td]
  );

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#f97316',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#f9731640',
        black: '#0a0a0a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#525252',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);

    setTimeout(() => {
      fit.fit();
    }, 100);

    terminalInstance.current = term;
    fitAddon.current = fit;

    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    fetchContainers().then((data) => {
      if (data.length > 0) {
        const containerToSelect = data[0].name;
        setSelectedContainer(containerToSelect);
        setTimeout(() => {
          connectToContainer(containerToSelect);
        }, 150);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      terminalInstance.current = null;
      fitAddon.current = null;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContainerChange = (value: string) => {
    setSelectedContainer(value);
    connectToContainer(value);
  };

  const handleReconnect = () => {
    if (selectedContainer) {
      connectToContainer(selectedContainer);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Container Selector */}
          <Select
            value={selectedContainer}
            onValueChange={handleContainerChange}
            disabled={loading}
          >
            <SelectTrigger className="w-full sm:w-[280px] h-10 bg-black/20 border-white/10 rounded-xl">
              <SelectValue placeholder={loading ? tc('loading') : td('selectContainer')} />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
              {containers.length === 0 && !loading && (
                <SelectItem value="none" disabled>
                  {td('noRunningContainers')}
                </SelectItem>
              )}
              {containers.map((container) => (
                <SelectItem key={container.id} value={container.name}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>{container.name.replace('phoenixd-dashboard-', '')}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
            <div
              className={cn(
                'h-2 w-2 rounded-full transition-all',
                connected
                  ? 'bg-green-500 shadow-[0_0_8px_hsl(142,76%,36%)]'
                  : 'bg-red-500 shadow-[0_0_8px_hsl(0,72%,51%)]'
              )}
            />
            <span className="text-xs font-medium">
              {connected ? tc('connected') : tc('disconnected')}
            </span>
          </div>
        </div>

        {/* Reconnect */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleReconnect}
          disabled={!selectedContainer || loading}
          className="h-9 px-4 rounded-xl w-full sm:w-auto"
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          {td('reconnect')}
        </Button>
      </div>

      {/* Terminal Container */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="h-[500px] p-4 bg-[#0a0a0a] relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 z-10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          )}
          <div ref={terminalRef} className="w-full h-full" />
        </div>

        {error && (
          <div className="px-4 py-3 border-t border-red-500/20 bg-red-500/10">
            <p className="text-sm text-red-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
