import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimations, ANIMATION_TYPES, type AnimationType } from '@/hooks/use-animations';

// Mock localStorage
let mockStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => mockStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStore[key];
  }),
  clear: vi.fn(() => {
    mockStore = {};
  }),
};

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

describe('useAnimations Hook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStore = {};
    localStorageMock.getItem.mockImplementation((key: string) => mockStore[key] ?? null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useAnimations());

      expect(result.current.animationType).toBe('confetti');
      expect(result.current.soundEnabled).toBe(true);
      expect(result.current.mounted).toBe(true);
    });

    it('should load saved animation type from localStorage', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'phoenixd-animation-type') return 'thunder';
        return null;
      });

      const { result } = renderHook(() => useAnimations());

      // Wait for useEffect to run
      expect(result.current.animationType).toBe('thunder');
    });

    it('should load saved sound preference from localStorage', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'phoenixd-animation-sound') return 'false';
        return null;
      });

      const { result } = renderHook(() => useAnimations());

      expect(result.current.soundEnabled).toBe(false);
    });

    it('should ignore invalid animation type from localStorage', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'phoenixd-animation-type') return 'invalid-type';
        return null;
      });

      const { result } = renderHook(() => useAnimations());

      expect(result.current.animationType).toBe('confetti');
    });
  });

  describe('Animation Type Management', () => {
    it('should update animation type', () => {
      const { result } = renderHook(() => useAnimations());

      act(() => {
        result.current.setAnimationType('thunder');
      });

      expect(result.current.animationType).toBe('thunder');
    });

    it('should persist animation type to localStorage', () => {
      const { result } = renderHook(() => useAnimations());

      act(() => {
        result.current.setAnimationType('fireworks');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('phoenixd-animation-type', 'fireworks');
    });

    it('should update animation info when type changes', () => {
      const { result } = renderHook(() => useAnimations());

      expect(result.current.animationInfo.id).toBe('confetti');
      expect(result.current.animationInfo.name).toBe('Confetti');

      act(() => {
        result.current.setAnimationType('thunder');
      });

      expect(result.current.animationInfo.id).toBe('thunder');
      expect(result.current.animationInfo.name).toBe('Thunder');
    });

    it('should support all animation types', () => {
      const { result } = renderHook(() => useAnimations());

      const animationTypes: AnimationType[] = [
        'confetti',
        'thunder',
        'fireworks',
        'spark',
        'coins',
        'none',
      ];

      animationTypes.forEach((type) => {
        act(() => {
          result.current.setAnimationType(type);
        });
        expect(result.current.animationType).toBe(type);
      });
    });
  });

  describe('Sound Management', () => {
    it('should toggle sound enabled', () => {
      const { result } = renderHook(() => useAnimations());

      expect(result.current.soundEnabled).toBe(true);

      act(() => {
        result.current.setSoundEnabled(false);
      });

      expect(result.current.soundEnabled).toBe(false);

      act(() => {
        result.current.setSoundEnabled(true);
      });

      expect(result.current.soundEnabled).toBe(true);
    });

    it('should persist sound preference to localStorage', () => {
      const { result } = renderHook(() => useAnimations());

      act(() => {
        result.current.setSoundEnabled(false);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('phoenixd-animation-sound', 'false');
    });
  });

  describe('Animation Types Constant', () => {
    it('should have 6 animation types defined', () => {
      expect(ANIMATION_TYPES).toHaveLength(6);
    });

    it('should have confetti as first option', () => {
      expect(ANIMATION_TYPES[0].id).toBe('confetti');
    });

    it('should have none as last option', () => {
      expect(ANIMATION_TYPES[ANIMATION_TYPES.length - 1].id).toBe('none');
    });

    it('should have all required properties for each type', () => {
      ANIMATION_TYPES.forEach((type) => {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('description');
        expect(type).toHaveProperty('icon');
      });
    });

    it('should include thunder animation', () => {
      const thunder = ANIMATION_TYPES.find((t) => t.id === 'thunder');
      expect(thunder).toBeDefined();
      expect(thunder?.icon).toBe('CloudLightning');
    });
  });

  describe('LocalStorage Error Handling', () => {
    it('should handle localStorage.getItem errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const { result } = renderHook(() => useAnimations());

      expect(result.current.animationType).toBe('confetti');
      expect(result.current.soundEnabled).toBe(true);
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const { result } = renderHook(() => useAnimations());

      // Should not throw
      expect(() => {
        act(() => {
          result.current.setAnimationType('thunder');
        });
      }).not.toThrow();

      // State should still update
      expect(result.current.animationType).toBe('thunder');
    });
  });

  describe('Mounted State', () => {
    it('should set mounted to true after initialization', () => {
      const { result } = renderHook(() => useAnimations());

      expect(result.current.mounted).toBe(true);
    });
  });
});
