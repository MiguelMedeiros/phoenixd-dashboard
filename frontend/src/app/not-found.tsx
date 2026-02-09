'use client';

import { useEffect, useState } from 'react';
import { Zap, Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const [sparks, setSparks] = useState<
    { id: number; x: number; y: number; delay: number; duration: number; size: number }[]
  >([]);

  useEffect(() => {
    const generated = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 1.5 + Math.random() * 2,
      size: 1 + Math.random() * 3,
    }));
    setSparks(generated);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[120px]" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[80px]" />

      {/* Floating spark particles */}
      {sparks.map((spark) => (
        <div
          key={spark.id}
          className="absolute rounded-full bg-orange-400/60 animate-pulse"
          style={{
            left: `${spark.x}%`,
            top: `${spark.y}%`,
            width: `${spark.size}px`,
            height: `${spark.size}px`,
            animationDelay: `${spark.delay}s`,
            animationDuration: `${spark.duration}s`,
          }}
        />
      ))}

      {/* Lightning bolt decorative lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[15%] left-[10%] w-[2px] h-40 bg-gradient-to-b from-orange-500/0 via-orange-500/20 to-orange-500/0 rotate-[25deg] animate-pulse"
          style={{ animationDuration: '3s' }}
        />
        <div
          className="absolute top-[60%] right-[15%] w-[2px] h-32 bg-gradient-to-b from-amber-500/0 via-amber-500/15 to-amber-500/0 -rotate-[30deg] animate-pulse"
          style={{ animationDelay: '1.5s', animationDuration: '3.5s' }}
        />
        <div
          className="absolute bottom-[20%] left-[20%] w-[2px] h-24 bg-gradient-to-b from-orange-400/0 via-orange-400/10 to-orange-400/0 rotate-[60deg] animate-pulse"
          style={{ animationDelay: '0.8s', animationDuration: '4s' }}
        />
        <div
          className="absolute top-[30%] right-[30%] w-[1px] h-36 bg-gradient-to-b from-amber-400/0 via-amber-400/10 to-amber-400/0 -rotate-[15deg] animate-pulse"
          style={{ animationDelay: '2s', animationDuration: '3s' }}
        />
      </div>

      <div className="relative max-w-lg w-full text-center space-y-8">
        {/* 404 number with lightning icon */}
        <div className="relative">
          {/* Glow behind the number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 bg-orange-500/15 rounded-full blur-3xl animate-pulse" />
          </div>

          <div className="relative flex items-center justify-center gap-2">
            <span className="text-[8rem] sm:text-[10rem] font-black leading-none tracking-tighter bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-600 bg-clip-text text-transparent select-none">
              4
            </span>
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-zinc-800/50 border border-orange-500/30 flex items-center justify-center backdrop-blur-sm">
                <Zap className="w-12 h-12 sm:w-16 sm:h-16 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
              </div>
            </div>
            <span className="text-[8rem] sm:text-[10rem] font-black leading-none tracking-tighter bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-600 bg-clip-text text-transparent select-none">
              4
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Lost in the Lightning</h1>

          <p className="text-zinc-400 leading-relaxed max-w-sm mx-auto">
            This route doesn&apos;t exist in the network. The page you&apos;re looking for may have
            been moved or is no longer available.
          </p>
        </div>

        {/* Glass card with actions */}
        <div className="bg-zinc-800/30 backdrop-blur-xl border border-zinc-700/40 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="flex-1 border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-700/40 text-zinc-200 py-5 text-base backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-5 text-base shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-zinc-700/50" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">or</span>
            <div className="h-px flex-1 bg-zinc-700/50" />
          </div>

          <Button
            onClick={() => (window.location.href = '/')}
            variant="ghost"
            className="w-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 py-5"
          >
            <Search className="w-4 h-4 mr-2" />
            Search in Dashboard
          </Button>
        </div>

        {/* Branding footer */}
        <div className="flex items-center justify-center gap-2 text-zinc-600">
          <Zap className="w-4 h-4 text-orange-500/50" />
          <span className="text-sm font-medium">Phoenixd Dashboard</span>
        </div>
      </div>
    </div>
  );
}
