"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Settings,
  Zap,
  ExternalLink,
  Github,
  BookOpen,
  Server,
  Wifi,
  Sun,
  Moon,
  Monitor,
  Palette,
  Sparkles,
  Copy,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getNodeInfo, getConnectionDetails } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NodeInfo {
  nodeId: string;
  chain: string;
  version: string;
}

// Fun messages that rotate
const funMessages = [
  "Stacking sats like a boss ⚡",
  "Lightning fast, as it should be ⚡",
  "21 million reasons to be here 🧡",
  "Running on pure Bitcoin energy ⚡",
  "Number go up technology™ 📈",
  "HODL mode: activated 💎",
  "Not your keys, not your coins 🔐",
  "Tick tock, next block ⏱️",
  "Stay humble, stack sats 🧘",
  "We're all gonna make it 🚀",
  "Laser eyes engaged 👀",
  "Orange pilling in progress 🍊",
  "Fix the money, fix the world 🌍",
  "Proof of work > Proof of stake 💪",
  "Running Bitcoin since... now! ⚡",
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [connectionDetails, setConnectionDetails] = useState<{ endpoint: string; apiKey: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [funMessage] = useState(() =>
    funMessages[Math.floor(Math.random() * funMessages.length)]
  );

  useEffect(() => {
    if (open && !nodeInfo) {
      setLoading(true);
      Promise.all([
        getNodeInfo(),
        getConnectionDetails(),
      ])
        .then(([nodeData, connectionData]) => {
          setNodeInfo({
            nodeId: nodeData.nodeId,
            chain: nodeData.chain,
            version: nodeData.version,
          });
          setConnectionDetails(connectionData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, nodeInfo]);

  const links = [
    {
      title: "Phoenixd Documentation",
      description: "Official API documentation",
      href: "https://phoenix.acinq.co/server/api",
      icon: BookOpen,
    },
    {
      title: "GitHub Repository",
      description: "View source code",
      href: "https://github.com/ACINQ/phoenixd",
      icon: Github,
    },
    {
      title: "Mempool Explorer",
      description: "View blockchain transactions",
      href: "https://mempool.space",
      icon: ExternalLink,
    },
  ];

  const themes = [
    { id: "dark", label: "Dark", icon: Moon, description: "Dark mode" },
    { id: "light", label: "Light", icon: Sun, description: "Light mode" },
    { id: "system", label: "Auto", icon: Monitor, description: "Follow system" },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">Settings</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Theme Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Theme
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                    theme === t.id
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.08] dark:border-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:border-black/[0.12] dark:hover:border-white/[0.08] text-muted-foreground"
                  )}
                >
                  <t.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Node Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Node Information
            </h3>
            <div className="glass-card rounded-xl p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Zap className="h-5 w-5 text-primary animate-pulse" />
                </div>
              ) : nodeInfo ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Server className="h-4 w-4" />
                      Version
                    </div>
                    <span className="text-sm font-mono">{nodeInfo.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wifi className="h-4 w-4" />
                      Network
                    </div>
                    <span className={cn(
                      "text-sm font-medium px-2 py-0.5 rounded-full",
                      nodeInfo.chain === "mainnet"
                        ? "bg-bitcoin/10 text-bitcoin"
                        : "bg-blue-500/10 text-blue-500"
                    )}>
                      {nodeInfo.chain}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-black/5 dark:border-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Node ID</p>
                    <p className="text-xs font-mono break-all text-foreground/80">
                      {nodeInfo.nodeId}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Unable to load node info
                </p>
              )}
            </div>
          </div>

          {/* Connection Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Key className="h-4 w-4" />
              Connection Details
            </h3>
            <div className="glass-card rounded-xl p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Zap className="h-5 w-5 text-primary animate-pulse" />
                </div>
              ) : connectionDetails ? (
                <>
                  {/* Endpoint */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Endpoint</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 truncate rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2 font-mono text-xs">
                        {connectionDetails.endpoint}
                      </div>
                      <button
                        onClick={() => copyToClipboard(connectionDetails.endpoint, "Endpoint")}
                        className="h-8 w-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">API Key</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 truncate rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2 font-mono text-xs">
                        {showApiKey ? connectionDetails.apiKey : "•".repeat(32)}
                      </div>
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="h-8 w-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(connectionDetails.apiKey, "API Key")}
                        className="h-8 w-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Unable to load connection details
                </p>
              )}
            </div>
          </div>

          {/* Useful Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Useful Links
            </h3>
            <div className="space-y-2">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:border-black/[0.12] dark:hover:border-white/[0.08] transition-all group"
                >
                  <div className="h-9 w-9 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors">
                    <link.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{link.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>

          {/* Fun Footer */}
          <div className="pt-4 border-t border-black/5 dark:border-white/5 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium">Phoenixd Dashboard</span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3" />
              {funMessage}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
