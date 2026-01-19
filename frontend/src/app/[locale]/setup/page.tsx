'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SetupWizard } from '@/components/setup/setup-wizard';
import { getSetupStatus } from '@/lib/api';
import { Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowWizard, setShouldShowWizard] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function checkSetupStatus() {
      try {
        const status = await getSetupStatus();
        if (status.setupCompleted) {
          // Setup already completed, redirect to dashboard
          router.replace('/');
        } else {
          setShouldShowWizard(true);
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
        // If we can't check, show the wizard anyway
        setShouldShowWizard(true);
      } finally {
        setIsLoading(false);
      }
    }

    checkSetupStatus();
  }, [router]);

  if (isLoading) {
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
          <source src="/electric-storm.mp4" type="video/mp4" />
        </video>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        {/* Fallback gradient background while video loads */}
        {!videoLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        )}

        <div className="text-center relative z-10">
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center border border-orange-500/20">
              <Zap className="h-8 w-8 text-orange-400 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            <span>Checking setup status...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!shouldShowWizard) {
    return null;
  }

  return <SetupWizard />;
}
