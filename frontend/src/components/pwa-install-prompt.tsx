'use client';

import { useState, useEffect } from 'react';
import { X, Download, Zap, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa_install_dismissed';

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      return;
    }

    // Detect iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // For iOS, show manual instructions after a delay
    if (isIOSDevice) {
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // For other browsers, listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a short delay
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsVisible(false);
        setInstallPrompt(null);
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(DISMISS_KEY, 'true');
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div
      className={cn(
        'fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50',
        'animate-in slide-in-from-bottom-5 fade-in duration-300'
      )}
    >
      <div className="glass-card rounded-2xl p-4 shadow-2xl border border-orange-500/20 bg-gradient-to-br from-zinc-900/95 to-zinc-800/95 backdrop-blur-xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>

        <div className="flex gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Zap className="h-7 w-7 text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm mb-1">Install Phoenixd Dashboard</h3>
            <p className="text-xs text-zinc-400 mb-3">
              {isIOS
                ? 'Tap the share button and "Add to Home Screen"'
                : 'Add to your home screen for quick access'}
            </p>

            {/* Actions */}
            {isIOS ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Smartphone className="h-4 w-4" />
                <span>Works offline • Fast access</span>
              </div>
            ) : (
              <button
                onClick={handleInstall}
                disabled={isInstalling || !installPrompt}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
                  'hover:from-orange-600 hover:to-amber-600',
                  'shadow-lg shadow-orange-500/25',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Download className="h-4 w-4" />
                {isInstalling ? 'Installing...' : 'Install App'}
              </button>
            )}
          </div>
        </div>

        {/* Decorative lightning */}
        <div className="absolute -top-1 -right-1 w-8 h-8 opacity-50">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-transparent rounded-full blur-lg" />
        </div>
      </div>
    </div>
  );
}
