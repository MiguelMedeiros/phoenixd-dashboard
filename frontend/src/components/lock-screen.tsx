'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LockScreenBg } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface LockScreenProps {
  onUnlock: (password: string) => Promise<boolean>;
  error?: string | null;
  background?: LockScreenBg;
}

// Background configuration
const backgroundConfig: Record<LockScreenBg, { video: string; gradient: string }> = {
  lightning: {
    video: '/lightning-bg.mp4',
    gradient: 'from-black/60 via-black/50 to-black/70',
  },
  'thunder-flash': {
    video: '/thunder-flash.mp4',
    gradient: 'from-black/60 via-black/50 to-black/70',
  },
  'storm-clouds': {
    video: '/storm-clouds.mp4',
    gradient: 'from-black/60 via-black/50 to-black/70',
  },
  'electric-storm': {
    video: '/electric-storm.mp4',
    gradient: 'from-black/60 via-black/50 to-black/70',
  },
  'night-lightning': {
    video: '/night-lightning.mp4',
    gradient: 'from-black/60 via-black/50 to-black/70',
  },
  'sky-thunder': {
    video: '/sky-thunder.mp4',
    gradient: 'from-black/60 via-black/50 to-black/70',
  },
};

// Fixed orange accent for all backgrounds
const accent = {
  ring: 'focus:ring-orange-500/30 focus:border-orange-500/40',
  button: 'bg-orange-500 hover:bg-orange-400',
  icon: 'text-orange-400',
};

export function LockScreen({
  onUnlock,
  error: externalError,
  background = 'storm-clouds',
}: LockScreenProps) {
  const t = useTranslations('lockScreen');
  const tf = useTranslations('funMessages');

  const funMessages = useMemo(
    () => [
      tf('stackingSats'),
      tf('lightningFast'),
      tf('twentyOneMillion'),
      tf('pureEnergy'),
      tf('numberGoUp'),
      tf('hodlMode'),
      tf('notYourKeys'),
      tf('tickTock'),
      tf('stayHumble'),
      tf('wagmi'),
    ],
    [tf]
  );

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [funMessageIndex] = useState(() => Math.floor(Math.random() * 10));
  const funMessage = funMessages[funMessageIndex];
  const [videoLoaded, setVideoLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const config = backgroundConfig[background] || backgroundConfig['storm-clouds'];

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync external error
  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError(t('enterPassword'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await onUnlock(password);

      if (!success) {
        setError(t('invalidPassword'));
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError(t('failedToUnlock'));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Video Background */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
        className={cn(
          'absolute inset-0 w-full h-full object-cover scale-105',
          'transition-opacity duration-1000',
          videoLoaded ? 'opacity-100' : 'opacity-0'
        )}
      >
        <source src={config.video} type="video/mp4" />
      </video>

      {/* Gradient Overlay */}
      <div className={cn('absolute inset-0 bg-gradient-to-b', config.gradient)} />

      {/* Fallback gradient background while video loads */}
      {!videoLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      )}

      <div className="relative z-10 w-full max-w-sm px-8">
        {/* Logo and Title - Minimal */}
        <div className="text-center mb-12">
          {/* Simple Lightning Icon */}
          <div className="inline-flex items-center justify-center mb-5">
            <Zap className={cn('h-10 w-10', accent.icon)} strokeWidth={1.5} />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white/90 mb-1">{t('title')}</h1>
          <p className="text-white/40 text-sm">{t('enterPasswordToContinue')}</p>
        </div>

        {/* Clean Form - No container box */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password Input - Floating style */}
          <div className={cn('relative transition-transform', shake && 'animate-shake')}>
            <input
              ref={inputRef}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('password')}
              disabled={isLoading}
              className={cn(
                'w-full px-4 py-3.5 pr-12 rounded-xl',
                'bg-white/[0.08] border border-white/[0.08]',
                'focus:outline-none focus:ring-1 focus:bg-white/[0.1]',
                accent.ring,
                'placeholder:text-white/25',
                'text-white text-base',
                'transition-all duration-200',
                error && 'border-red-500/40 bg-red-500/[0.05]',
                !showPassword && 'lock-input-masked'
              )}
              name="search_query"
              id="search_query"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              aria-autocomplete="none"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/10 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-white/40" />
              ) : (
                <Eye className="h-4 w-4 text-white/40" />
              )}
            </button>
          </div>

          {/* Error Message - Inline and subtle */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400/90 px-1">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Unlock Button - Clean and minimal */}
          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className={cn(
              'w-full py-3.5 px-5 rounded-xl font-medium',
              accent.button,
              'text-black/90',
              'active:scale-[0.98]',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100',
              'transition-all duration-200',
              'flex items-center justify-center gap-2'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('unlocking')}</span>
              </>
            ) : (
              <>
                <span>{t('unlock')}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Fun Footer - Very subtle */}
        <div className="mt-16 text-center">
          <p className="text-xs text-white/25">{funMessage}</p>
        </div>
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-4px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(4px);
          }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        .lock-input-masked {
          -webkit-text-security: disc;
          -moz-text-security: disc;
          text-security: disc;
        }
      `}</style>
    </div>
  );
}
