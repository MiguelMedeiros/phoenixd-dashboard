'use client';

import { useState, useEffect, useCallback } from 'react';

// Animation types available for celebrations
export const ANIMATION_TYPES = [
  {
    id: 'confetti',
    name: 'Confetti',
    description: 'Classic colorful celebration',
    icon: 'PartyPopper',
  },
  {
    id: 'thunder',
    name: 'Thunder',
    description: 'Lightning flash with thunder',
    icon: 'CloudLightning',
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    description: 'Explosive celebration',
    icon: 'Sparkles',
  },
  {
    id: 'spark',
    name: 'Electric Spark',
    description: 'Electric energy burst',
    icon: 'Zap',
  },
  {
    id: 'coins',
    name: 'Coin Rain',
    description: 'Sats raining down',
    icon: 'Coins',
  },
  {
    id: 'none',
    name: 'None',
    description: 'No animations',
    icon: 'Ban',
  },
] as const;

export type AnimationType = (typeof ANIMATION_TYPES)[number]['id'];

export interface AnimationInfo {
  id: AnimationType;
  name: string;
  description: string;
  icon: string;
}

const STORAGE_KEY = 'phoenixd-animation-type';
const SOUND_ENABLED_KEY = 'phoenixd-animation-sound';

export interface UseAnimationsReturn {
  animationType: AnimationType;
  animationInfo: AnimationInfo;
  setAnimationType: (type: AnimationType) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  mounted: boolean;
}

export function useAnimations(): UseAnimationsReturn {
  const [animationType, setAnimationTypeState] = useState<AnimationType>('confetti');
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Get animation info
  const animationInfo = ANIMATION_TYPES.find((a) => a.id === animationType) || ANIMATION_TYPES[0];

  // Load saved preferences on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedType = localStorage.getItem(STORAGE_KEY);
      if (savedType && ANIMATION_TYPES.some((a) => a.id === savedType)) {
        setAnimationTypeState(savedType as AnimationType);
      }
    } catch {
      // localStorage not available
    }

    try {
      const savedSound = localStorage.getItem(SOUND_ENABLED_KEY);
      if (savedSound !== null) {
        setSoundEnabledState(savedSound === 'true');
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const setAnimationType = useCallback((type: AnimationType) => {
    setAnimationTypeState(type);
    try {
      localStorage.setItem(STORAGE_KEY, type);
    } catch {
      // localStorage not available
    }
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
    } catch {
      // localStorage not available
    }
  }, []);

  return {
    animationType,
    animationInfo,
    setAnimationType,
    soundEnabled,
    setSoundEnabled,
    mounted,
  };
}
