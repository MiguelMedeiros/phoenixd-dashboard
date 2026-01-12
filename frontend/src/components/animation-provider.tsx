'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import {
  useAnimations,
  type UseAnimationsReturn,
  type AnimationType,
  ANIMATION_TYPES,
} from '@/hooks/use-animations';
import { triggerAnimation, previewAnimation } from '@/lib/animation-effects';

interface AnimationContextType extends UseAnimationsReturn {
  playAnimation: (mini?: boolean) => void;
  previewAnimation: (type: AnimationType) => void;
}

const AnimationContext = createContext<AnimationContextType | null>(null);

export function useAnimationContext(): AnimationContextType {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimationContext must be used within AnimationProvider');
  }
  return context;
}

interface AnimationProviderProps {
  children: ReactNode;
}

export function AnimationProvider({ children }: AnimationProviderProps) {
  const animationState = useAnimations();

  const playAnimation = useCallback(
    (mini = false) => {
      triggerAnimation(animationState.animationType, animationState.soundEnabled, mini);
    },
    [animationState.animationType, animationState.soundEnabled]
  );

  const handlePreviewAnimation = useCallback((type: AnimationType) => {
    previewAnimation(type);
  }, []);

  const value: AnimationContextType = {
    ...animationState,
    playAnimation,
    previewAnimation: handlePreviewAnimation,
  };

  return <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>;
}

// Re-export types and constants for convenience
export { ANIMATION_TYPES };
export type { AnimationType };
