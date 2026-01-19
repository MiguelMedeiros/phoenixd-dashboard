'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Zap, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { completeSetup, type SetupConfig } from '@/lib/api';
import { locales } from '@/i18n/routing';

import { StepProfile, type ProfileType } from './step-profile';
import { StepPassword } from './step-password';
import { StepLanguage } from './step-language';
import { StepTheme } from './step-theme';
import { StepBackground } from './step-background';
import { StepPhoenixd, type PhoenixdConfig } from './step-phoenixd';
import { StepNetwork, type NetworkConfig } from './step-network';
import { StepApps, type AppsConfig } from './step-apps';
import { StepReview } from './step-review';
import type { LockScreenBg } from '@/lib/api';

// Background configuration for video backgrounds
const backgroundConfig: Record<LockScreenBg, string> = {
  lightning: '/lightning-bg.mp4',
  'thunder-flash': '/thunder-flash.mp4',
  'storm-clouds': '/storm-clouds.mp4',
  'electric-storm': '/electric-storm.mp4',
  'night-lightning': '/night-lightning.mp4',
  'sky-thunder': '/sky-thunder.mp4',
};

export type WizardStep =
  | 'profile'
  | 'password'
  | 'language'
  | 'theme'
  | 'background'
  | 'phoenixd'
  | 'network'
  | 'apps'
  | 'review';

const CUSTOM_STEPS: WizardStep[] = [
  'language',
  'password',
  'profile',
  'theme',
  'background',
  'phoenixd',
  'network',
  'apps',
  'review',
];

const QUICK_STEPS: WizardStep[] = ['language', 'password', 'profile', 'review'];

const WIZARD_STATE_KEY = 'phoenixd-setup-wizard-state';

interface WizardState {
  profile: ProfileType;
  password: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  lockScreenBg: LockScreenBg;
  phoenixd: PhoenixdConfig;
  network: NetworkConfig;
  apps: AppsConfig;
}

interface PersistedState {
  state: WizardState;
  step: WizardStep;
  timestamp: number;
}

const defaultState: WizardState = {
  profile: 'custom',
  password: '',
  locale: 'en',
  theme: 'system',
  lockScreenBg: 'electric-storm',
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

// Helper to get persisted state from sessionStorage
function getPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(WIZARD_STATE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PersistedState;
    // Expire after 30 minutes
    if (Date.now() - parsed.timestamp > 30 * 60 * 1000) {
      sessionStorage.removeItem(WIZARD_STATE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Helper to persist state to sessionStorage
function persistState(state: WizardState, step: WizardStep) {
  if (typeof window === 'undefined') return;
  try {
    const data: PersistedState = { state, step, timestamp: Date.now() };
    sessionStorage.setItem(WIZARD_STATE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

// Helper to clear persisted state
function clearPersistedState() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(WIZARD_STATE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function SetupWizard() {
  const t = useTranslations('setup');
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  // Initialize state from sessionStorage or defaults
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    const persisted = getPersistedState();
    return persisted?.step || 'language';
  });

  const [state, setState] = useState<WizardState>(() => {
    const persisted = getPersistedState();
    if (persisted) {
      return persisted.state;
    }
    // Get locale from URL for initial state
    const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/') : [];
    const pathLocale = pathParts[1];
    const initialLocale = locales.includes(pathLocale as (typeof locales)[number])
      ? pathLocale
      : 'en';
    return { ...defaultState, locale: initialLocale };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Persist state whenever it changes
  useEffect(() => {
    persistState(state, currentStep);
  }, [state, currentStep]);

  // Handle locale change - persist state and navigate
  const handleLocaleChange = useCallback(
    (locale: string) => {
      // Persist current state before navigation
      persistState({ ...state, locale }, currentStep);
      // Navigate to new locale
      router.replace(pathname, { locale });
    },
    [state, currentStep, router, pathname]
  );

  // Get steps based on profile
  const steps = state.profile === 'custom' ? CUSTOM_STEPS : QUICK_STEPS;
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const updateState = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleProfileSelect = useCallback(
    (profile: ProfileType) => {
      // Preserve locale, password, theme, and lockScreenBg that were already set
      const newState: WizardState = {
        ...defaultState,
        profile,
        locale: state.locale,
        password: state.password,
        theme: state.theme,
        lockScreenBg: state.lockScreenBg,
      };

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
    },
    [state.locale, state.password, state.theme, state.lockScreenBg]
  );

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
      case 'background':
        return !!state.lockScreenBg;
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
        lockScreenBg: state.lockScreenBg,
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
        // Clear persisted wizard state
        clearPersistedState();

        toast({
          title: t('setupComplete'),
          description: t('welcomeMessage'),
        });

        // Redirect to dashboard with the selected locale
        router.replace('/', { locale: result.locale || 'en' });
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
          <StepLanguage
            value={state.locale}
            onChange={(value) => updateState('locale', value)}
            onLocaleChange={handleLocaleChange}
          />
        );
      case 'theme':
        return <StepTheme value={state.theme} onChange={(value) => updateState('theme', value)} />;
      case 'background':
        return (
          <StepBackground
            value={state.lockScreenBg}
            onChange={(value) => updateState('lockScreenBg', value)}
          />
        );
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

  const videoSrc = backgroundConfig[state.lockScreenBg] || backgroundConfig['electric-storm'];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Video Background */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        key={videoSrc}
        onLoadedData={() => setVideoLoaded(true)}
        className={cn(
          'absolute inset-0 w-full h-full object-cover scale-105',
          'transition-opacity duration-1000',
          videoLoaded ? 'opacity-100' : 'opacity-0'
        )}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

      {/* Fallback gradient background while video loads */}
      {!videoLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      )}

      <div className="w-full max-w-2xl relative z-10 p-4 md:p-8 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center border border-orange-500/20">
                <Zap className="h-8 w-8 text-orange-400" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white">{t('title')}</h1>
          <p className="text-white/60">{t('subtitle')}</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-white/60 mb-2">
            <span>
              {t('step')} {currentStepIndex + 1} {t('of')} {steps.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content - Always dark theme styling for contrast with video background */}
        <div className="backdrop-blur-xl bg-black/40 border border-white/20 rounded-2xl p-6 md:p-8 mb-6 setup-wizard-content">
          <div key={currentStep} className="animate-in fade-in duration-200">
            {renderStep()}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {currentStepIndex > 0 ? (
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={isSubmitting}
              className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
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
              className="gap-2 bg-orange-500 hover:bg-orange-400 text-black"
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
            <Button
              onClick={goNext}
              disabled={!canGoNext() || isSubmitting}
              className="gap-2 bg-orange-500 hover:bg-orange-400 text-black"
            >
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
