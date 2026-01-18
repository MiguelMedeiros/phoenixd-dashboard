'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Zap, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { completeSetup, type SetupConfig } from '@/lib/api';
import { locales } from '@/i18n/routing';

import { StepProfile, type ProfileType } from './step-profile';
import { StepPassword } from './step-password';
import { StepLanguage } from './step-language';
import { StepTheme } from './step-theme';
import { StepPhoenixd, type PhoenixdConfig } from './step-phoenixd';
import { StepNetwork, type NetworkConfig } from './step-network';
import { StepApps, type AppsConfig } from './step-apps';
import { StepReview } from './step-review';

export type WizardStep =
  | 'profile'
  | 'password'
  | 'language'
  | 'theme'
  | 'phoenixd'
  | 'network'
  | 'apps'
  | 'review';

const CUSTOM_STEPS: WizardStep[] = [
  'profile',
  'password',
  'language',
  'theme',
  'phoenixd',
  'network',
  'apps',
  'review',
];

const QUICK_STEPS: WizardStep[] = ['profile', 'password', 'review'];

interface WizardState {
  profile: ProfileType;
  password: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  phoenixd: PhoenixdConfig;
  network: NetworkConfig;
  apps: AppsConfig;
}

const defaultState: WizardState = {
  profile: 'custom',
  password: '',
  locale: 'en',
  theme: 'system',
  phoenixd: {
    type: 'docker',
    connections: [],
  },
  network: {
    tailscale: { enabled: false },
    cloudflared: { enabled: false },
    tor: { enabled: false },
  },
  apps: {
    donations: true,
  },
};

export function SetupWizard() {
  const t = useTranslations('setup');
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Get current locale from URL
  const currentLocale = useMemo(() => {
    const pathLocale = pathname.split('/')[1];
    return locales.includes(pathLocale as (typeof locales)[number]) ? pathLocale : 'en';
  }, [pathname]);

  const [currentStep, setCurrentStep] = useState<WizardStep>('profile');
  const [state, setState] = useState<WizardState>(() => ({
    ...defaultState,
    locale: currentLocale,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get steps based on profile
  const steps = state.profile === 'custom' ? CUSTOM_STEPS : QUICK_STEPS;
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const updateState = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleProfileSelect = useCallback((profile: ProfileType) => {
    const newState = { ...defaultState, profile };

    // Set defaults based on profile
    if (profile === 'minimal') {
      newState.phoenixd = { type: 'docker', connections: [] };
      newState.network = {
        tailscale: { enabled: false },
        cloudflared: { enabled: false },
        tor: { enabled: false },
      };
      newState.apps = { donations: false };
    } else if (profile === 'full') {
      newState.phoenixd = { type: 'docker', connections: [] };
      newState.apps = { donations: true };
    }

    setState(newState);
  }, []);

  const canGoNext = useCallback((): boolean => {
    switch (currentStep) {
      case 'profile':
        return !!state.profile;
      case 'password':
        return state.password.length >= 4;
      case 'language':
        return !!state.locale;
      case 'theme':
        return !!state.theme;
      case 'phoenixd':
        if (state.phoenixd.type === 'docker') return true;
        return state.phoenixd.connections.length > 0;
      case 'network':
        return true; // Network is optional
      case 'apps':
        return true; // Apps are optional
      case 'review':
        return true;
      default:
        return false;
    }
  }, [currentStep, state]);

  const goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  }, [currentStepIndex, steps]);

  const goPrev = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  }, [currentStepIndex, steps]);

  const handleComplete = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const config: SetupConfig = {
        profile: state.profile,
        password: state.password,
        locale: state.locale,
        theme: state.theme,
        phoenixd: state.phoenixd,
        network: {
          tailscale: state.network.tailscale?.enabled
            ? {
                enabled: true,
                authKey: state.network.tailscale.authKey,
                hostname: state.network.tailscale.hostname,
              }
            : undefined,
          cloudflared: state.network.cloudflared?.enabled
            ? {
                enabled: true,
                token: state.network.cloudflared.token,
              }
            : undefined,
          tor: state.network.tor?.enabled ? { enabled: true } : undefined,
        },
        apps: state.apps,
      };

      const result = await completeSetup(config);

      if (result.success) {
        toast({
          title: t('setupComplete'),
          description: t('welcomeMessage'),
        });

        // Redirect to dashboard with the selected locale
        router.replace(`/${result.locale || 'en'}`);
      }
    } catch (error) {
      console.error('Setup failed:', error);
      toast({
        title: t('setupFailed'),
        description: error instanceof Error ? error.message : t('unknownError'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [state, router, toast, t]);

  const renderStep = () => {
    switch (currentStep) {
      case 'profile':
        return <StepProfile value={state.profile} onChange={handleProfileSelect} />;
      case 'password':
        return (
          <StepPassword
            value={state.password}
            onChange={(value) => updateState('password', value)}
          />
        );
      case 'language':
        return (
          <StepLanguage value={state.locale} onChange={(value) => updateState('locale', value)} />
        );
      case 'theme':
        return <StepTheme value={state.theme} onChange={(value) => updateState('theme', value)} />;
      case 'phoenixd':
        return (
          <StepPhoenixd
            value={state.phoenixd}
            onChange={(value) => updateState('phoenixd', value)}
          />
        );
      case 'network':
        return (
          <StepNetwork value={state.network} onChange={(value) => updateState('network', value)} />
        );
      case 'apps':
        return <StepApps value={state.apps} onChange={(value) => updateState('apps', value)} />;
      case 'review':
        return <StepReview config={state} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/20">
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>
              {t('step')} {currentStepIndex + 1} {t('of')} {steps.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="glass-card rounded-2xl p-6 md:p-8 mb-6">
          <div key={currentStep} className="animate-in fade-in duration-200">
            {renderStep()}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {currentStepIndex > 0 ? (
            <Button variant="outline" onClick={goPrev} disabled={isSubmitting} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              {t('back')}
            </Button>
          ) : (
            <div />
          )}

          {currentStep === 'review' ? (
            <Button
              onClick={handleComplete}
              disabled={!canGoNext() || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">
                    <Zap className="h-4 w-4" />
                  </span>
                  {t('completing')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t('completeSetup')}
                </>
              )}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoNext() || isSubmitting} className="gap-2">
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
