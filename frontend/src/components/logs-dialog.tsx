'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollText, X, RefreshCw, Loader2, Pause, Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getContainers, ContainerInfo } from '@/lib/api';
import { getWsUrl } from '@/hooks/use-dynamic-urls';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LogsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface LogLine {
  timestamp: string;
  message: string;
  stream: 'stdout' | 'stderr';
}

export function LogsDialog({ open, onClose }: LogsDialogProps) {
  const t = useTranslations('docker');
  const tc = useTranslations('common');
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
      // Try to extract timestamp (ISO format at start of line)
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
        // No timestamp, just add the line
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

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnected(false);
      setError(null);
      setLogs([]);

      // Build WebSocket URL
      const wsUrl = getWsUrl();
      const url = `${wsUrl}/ws/docker/logs/${containerName}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
        };

        ws.onmessage = (event) => {
          // Check paused state via ref to avoid dependency issues
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
            // Raw data
            const newLines = parseLogLine(event.data);
            setLogs((prev) => [...prev, ...newLines].slice(-1000));
          }
        };

        ws.onerror = () => {
          setError(t('connectionError'));
          setConnected(false);
        };

        ws.onclose = () => {
          setConnected(false);
        };
      } catch (err) {
        console.error('WebSocket error:', err);
        setError(t('failedToConnect'));
      }
    },
    [parseLogLine, t]
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
      setError(t('failedToLoadContainers'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!paused && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, paused]);

  // Initialize on open
  useEffect(() => {
    if (open) {
      fetchContainers().then((data) => {
        if (data.length > 0) {
          const running = data.find((c) => c.state === 'running');
          const containerToSelect = running?.name || data[0].name;
          setSelectedContainer(containerToSelect);
          connectToLogs(containerToSelect);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle container change
  const handleContainerChange = (value: string) => {
    setSelectedContainer(value);
    connectToLogs(value);
  };

  // Cleanup on close
  useEffect(() => {
    if (!open && wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [open]);

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Handle reconnect
  const handleReconnect = () => {
    if (selectedContainer) {
      connectToLogs(selectedContainer);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-5xl h-[700px] -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]">
        <div className="glass-card rounded-2xl shadow-2xl border border-white/10 h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <ScrollText className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t('logs')}</h2>
                <p className="text-sm text-muted-foreground">{t('realTimeLogs')}</p>
              </div>
            </div>

            {/* Close Button */}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {/* Container Selector */}
              <Select
                value={selectedContainer}
                onValueChange={handleContainerChange}
                disabled={loading}
              >
                <SelectTrigger className="w-[280px] h-10 bg-black/20 border-white/10 rounded-xl">
                  <SelectValue placeholder={loading ? tc('loading') : t('selectContainer')} />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
                  {containers.length === 0 && !loading && (
                    <SelectItem value="none" disabled>
                      {t('noContainers')}
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
                  {connected ? (paused ? t('paused') : tc('connected')) : tc('disconnected')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Pause/Resume Button */}
              <Button
                variant={paused ? 'lightning' : 'outline'}
                size="sm"
                onClick={() => setPaused(!paused)}
                className="h-9 px-4 rounded-xl"
              >
                {paused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {t('resume')}
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    {t('pause')}
                  </>
                )}
              </Button>

              {/* Clear Logs Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
                className="h-9 px-4 rounded-xl"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('clearLogs')}
              </Button>

              {/* Reconnect Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReconnect}
                disabled={!selectedContainer || loading}
                className="h-9 px-4 rounded-xl"
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                {t('reconnect')}
              </Button>
            </div>
          </div>

          {/* Logs */}
          <div
            ref={logsContainerRef}
            className="flex-1 overflow-auto bg-[#0a0a0a] p-4 font-mono text-[13px] leading-relaxed"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <ScrollText className="h-12 w-12 opacity-20" />
                <p>{t('noLogs')}</p>
              </div>
            ) : (
              <div className="space-y-px">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex gap-4 py-1 px-2 -mx-2 rounded hover:bg-white/[0.03] transition-colors',
                      log.stream === 'stderr' && 'text-red-400'
                    )}
                  >
                    <span className="text-muted-foreground/60 flex-shrink-0 w-20 text-xs tabular-nums">
                      {log.timestamp}
                    </span>
                    <span className="break-all whitespace-pre-wrap text-foreground/90">
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with error */}
          {error && (
            <div className="px-4 py-3 border-t border-red-500/20 bg-red-500/10">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {error}
              </p>
            </div>
          )}

          {/* Footer with log count */}
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
            <span className="text-sm text-muted-foreground tabular-nums">
              {logs.length.toLocaleString()} {t('logLines')}
            </span>
            {paused && (
              <span className="text-sm text-yellow-500 flex items-center gap-2">
                <Pause className="h-3 w-3" />
                {t('pausedHint')}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
