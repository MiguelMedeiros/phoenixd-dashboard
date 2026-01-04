'use client';

import { WifiOff, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="relative mx-auto w-32 h-32">
          <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative w-full h-full rounded-full bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
            <WifiOff className="w-16 h-16 text-orange-500" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-6 h-6 text-orange-500" />
            <h1 className="text-2xl font-bold text-white">Phoenixd Dashboard</h1>
          </div>

          <h2 className="text-xl font-semibold text-zinc-200">You&apos;re Offline</h2>

          <p className="text-zinc-400 leading-relaxed">
            It looks like you&apos;ve lost your internet connection. Please check your network and
            try again.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Button
            onClick={handleRetry}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-6 text-lg"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>

          <p className="text-sm text-zinc-500">
            The app will automatically reconnect when you&apos;re back online.
          </p>
        </div>

        {/* Lightning effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-1 h-32 bg-gradient-to-b from-orange-500/0 via-orange-500/30 to-orange-500/0 rotate-45 animate-pulse" />
          <div
            className="absolute bottom-1/4 right-1/4 w-1 h-24 bg-gradient-to-b from-amber-500/0 via-amber-500/20 to-amber-500/0 -rotate-45 animate-pulse"
            style={{ animationDelay: '1s' }}
          />
        </div>
      </div>
    </div>
  );
}
