'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, X, RefreshCw, Loader2 } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
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

interface TerminalDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TerminalDialog({ open, onClose }: TerminalDialogProps) {
  const t = useTranslations('docker');
  const tc = useTranslations('common');
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
      // Only show running containers for terminal
      const runningContainers = data.filter((c) => c.state === 'running');
      setContainers(runningContainers);
      return runningContainers;
    } catch (err) {
      console.error('Failed to fetch containers:', err);
      setError(t('failedToLoadContainers'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Connect to container
  const connectToContainer = useCallback(
    (containerName: string) => {
      if (!containerName || !terminalInstance.current) return;

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnected(false);
      setError(null);

      const term = terminalInstance.current;
      term.clear();
      term.writeln(`\x1b[33m${t('connectingTo')} ${containerName}...\x1b[0m`);

      // Build WebSocket URL
      const wsUrl = getWsUrl();
      const url = `${wsUrl}/ws/docker/exec/${containerName}`;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          term.clear();
          term.writeln(`\x1b[32m${t('connectedTo')} ${containerName}\x1b[0m`);
          term.writeln('');
          term.focus();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'output') {
              term.write(data.data);
            } else if (data.type === 'error') {
              term.writeln(`\x1b[31m${t('error')}: ${data.message}\x1b[0m`);
              setError(data.message);
            } else if (data.type === 'end') {
              term.writeln('');
              term.writeln(`\x1b[33m${t('connectionClosed')}\x1b[0m`);
              setConnected(false);
            }
          } catch {
            term.write(event.data);
          }
        };

        ws.onerror = () => {
          term.writeln(`\x1b[31m${t('connectionError')}\x1b[0m`);
          setError(t('connectionError'));
          setConnected(false);
        };

        ws.onclose = () => {
          setConnected(false);
        };

        // Send terminal input to WebSocket
        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });
      } catch (err) {
        console.error('WebSocket error:', err);
        setError(t('failedToConnect'));
      }
    },
    [t]
  );

  // Initialize terminal
  useEffect(() => {
    if (!open || !terminalRef.current) return;

    // Create terminal instance
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

    // Delay fit to ensure container is rendered
    setTimeout(() => {
      fit.fit();
    }, 100);

    terminalInstance.current = term;
    fitAddon.current = fit;

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    // Fetch containers and connect to first one
    fetchContainers().then((data) => {
      if (data.length > 0) {
        const containerToSelect = data[0].name;
        setSelectedContainer(containerToSelect);
        // Small delay to ensure terminal is ready
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle container change
  const handleContainerChange = (value: string) => {
    setSelectedContainer(value);
    connectToContainer(value);
  };

  // Handle reconnect
  const handleReconnect = () => {
    if (selectedContainer) {
      connectToContainer(selectedContainer);
    }
  };

  // Cleanup on close
  useEffect(() => {
    if (!open && wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [open]);

  // Refit terminal when dialog is opened
  useEffect(() => {
    if (open && fitAddon.current) {
      setTimeout(() => {
        fitAddon.current?.fit();
      }, 200);
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-5xl h-[80vh] sm:h-[700px] -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]">
        <div className="rounded-2xl shadow-2xl border border-border bg-card h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                <TerminalIcon className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t('terminal')}</h2>
                <p className="text-sm text-muted-foreground">{t('interactiveShell')}</p>
              </div>
            </div>

            {/* Close Button */}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-border bg-muted/30">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Container Selector */}
              <Select
                value={selectedContainer}
                onValueChange={handleContainerChange}
                disabled={loading}
              >
                <SelectTrigger className="w-full sm:w-[280px] h-10 bg-background border-border rounded-xl">
                  <SelectValue placeholder={loading ? tc('loading') : t('selectContainer')} />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {containers.length === 0 && !loading && (
                    <SelectItem value="none" disabled>
                      {t('noRunningContainers')}
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
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
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

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Reconnect Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReconnect}
                disabled={!selectedContainer || loading}
                className="h-9 px-3 sm:px-4 rounded-xl flex-1 sm:flex-none"
              >
                <RefreshCw className={cn('h-4 w-4 sm:mr-2', loading && 'animate-spin')} />
                <span className="hidden sm:inline">{t('reconnect')}</span>
              </Button>
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 p-4 bg-zinc-900 relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            )}
            <div ref={terminalRef} className="w-full h-full" />
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
        </div>
      </div>
    </>
  );
}
