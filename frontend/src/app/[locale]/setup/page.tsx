'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SetupWizard } from '@/components/setup/setup-wizard';
import { getSetupStatus } from '@/lib/api';
import { Zap, Loader2 } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowWizard, setShouldShowWizard] = useState(false);

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
      <div className="fixed inset-0 z-50 flex items-center justify-center premium-bg">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/20">
              <Zap className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
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
