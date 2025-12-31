'use client';

import { useEffect, useState } from 'react';
import { Zap, Server, Wifi, Copy, Check, Github, BookOpen, X } from 'lucide-react';
import { getNodeInfo } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NodeInfo {
  nodeId: string;
  chain: string;
  version: string;
}

interface NodeInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NodeInfoDialog({ open, onClose }: NodeInfoDialogProps) {
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && !nodeInfo) {
      setLoading(true);
      getNodeInfo()
        .then((data) => {
          setNodeInfo({
            nodeId: data.nodeId,
            chain: data.chain,
            version: data.version,
          });
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, nodeInfo]);

  const copyNodeId = async () => {
    if (nodeInfo?.nodeId) {
      await navigator.clipboard.writeText(nodeInfo.nodeId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const links = [
    {
      title: 'Phoenixd Docs',
      href: 'https://phoenix.acinq.co/server/api',
      icon: BookOpen,
    },
    {
      title: 'Phoenixd',
      href: 'https://github.com/ACINQ/phoenixd',
      icon: Github,
    },
    {
      title: 'Dashboard',
      href: 'https://github.com/MiguelMedeiros/phoenixd-dashboard',
      icon: Github,
    },
  ];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]">
        <div className="glass-card rounded-2xl p-6 shadow-2xl border border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Phoenixd Node</h2>
                <p className="text-xs text-muted-foreground">Lightning Network</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Zap className="h-6 w-6 text-primary animate-pulse" />
            </div>
          ) : nodeInfo ? (
            <div className="space-y-4">
              {/* Version & Network */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Server className="h-3.5 w-3.5" />
                    <span className="text-xs">Version</span>
                  </div>
                  <p className="font-mono text-sm font-medium">{nodeInfo.version}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wifi className="h-3.5 w-3.5" />
                    <span className="text-xs">Network</span>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium px-2 py-0.5 rounded-full inline-block',
                      nodeInfo.chain === 'mainnet'
                        ? 'bg-bitcoin/10 text-bitcoin'
                        : 'bg-blue-500/10 text-blue-500'
                    )}
                  >
                    {nodeInfo.chain}
                  </span>
                </div>
              </div>

              {/* Node ID */}
              <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Node ID</span>
                  <button
                    onClick={copyNodeId}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-green-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs font-mono break-all text-foreground/80 leading-relaxed">
                  {nodeInfo.nodeId}
                </p>
              </div>

              {/* Links */}
              <div className="pt-2 border-t border-black/5 dark:border-white/5">
                <div className="flex gap-2">
                  {links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors group"
                    >
                      <link.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {link.title}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Unable to load node info
            </p>
          )}
        </div>
      </div>
    </>
  );
}
