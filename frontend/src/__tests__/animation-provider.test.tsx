import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { AnimationProvider, useAnimationContext } from '@/components/animation-provider';

// Mock the animation effects
vi.mock('@/lib/animation-effects', () => ({
  triggerAnimation: vi.fn(),
  previewAnimation: vi.fn(),
}));

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

describe('AnimationProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStore = {};
    localStorageMock.getItem.mockImplementation((key: string) => mockStore[key] ?? null);
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AnimationProvider>{children}</AnimationProvider>
  );

  describe('Context Provider', () => {
    it('provides animation context to children', () => {
      const TestComponent = () => {
        const context = useAnimationContext();
        return (
          <div>
            <span data-testid="type">{context.animationType}</span>
            <span data-testid="sound">{context.soundEnabled.toString()}</span>
          </div>
        );
      };

      render(
        <AnimationProvider>
          <TestComponent />
        </AnimationProvider>
      );

      expect(screen.getByTestId('type')).toHaveTextContent('confetti');
      expect(screen.getByTestId('sound')).toHaveTextContent('true');
    });

    it('throws error when used outside provider', () => {
      const TestComponent = () => {
        useAnimationContext();
        return null;
      };

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => render(<TestComponent />)).toThrow(
        'useAnimationContext must be used within AnimationProvider'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Animation Type Management', () => {
    it('allows changing animation type', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(result.current.animationType).toBe('confetti');

      act(() => {
        result.current.setAnimationType('thunder');
      });

      expect(result.current.animationType).toBe('thunder');
    });

    it('provides all animation types', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      const types: Array<'confetti' | 'thunder' | 'fireworks' | 'spark' | 'coins' | 'none'> = [
        'confetti',
        'thunder',
        'fireworks',
        'spark',
        'coins',
        'none',
      ];

      types.forEach((type) => {
        act(() => {
          result.current.setAnimationType(type);
        });
        expect(result.current.animationType).toBe(type);
      });
    });
  });

  describe('Sound Management', () => {
    it('allows toggling sound', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(result.current.soundEnabled).toBe(true);

      act(() => {
        result.current.setSoundEnabled(false);
      });

      expect(result.current.soundEnabled).toBe(false);
    });
  });

  describe('Play Animation', () => {
    it('provides playAnimation function', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(typeof result.current.playAnimation).toBe('function');
    });

    it('calls playAnimation without errors', async () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(() => {
        act(() => {
          result.current.playAnimation();
        });
      }).not.toThrow();
    });

    it('calls playAnimation with mini parameter', async () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(() => {
        act(() => {
          result.current.playAnimation(true);
        });
      }).not.toThrow();
    });
  });

  describe('Preview Animation', () => {
    it('provides previewAnimation function', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(typeof result.current.previewAnimation).toBe('function');
    });

    it('calls previewAnimation without errors', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(() => {
        act(() => {
          result.current.previewAnimation('thunder');
        });
      }).not.toThrow();
    });
  });

  describe('Animation Info', () => {
    it('provides animation info for current type', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      expect(result.current.animationInfo).toBeDefined();
      expect(result.current.animationInfo.id).toBe('confetti');
      expect(result.current.animationInfo.name).toBe('Confetti');
    });

    it('updates animation info when type changes', () => {
      const { result } = renderHook(() => useAnimationContext(), { wrapper });

      act(() => {
        result.current.setAnimationType('thunder');
      });

      expect(result.current.animationInfo.id).toBe('thunder');
      expect(result.current.animationInfo.name).toBe('Thunder');
    });
  });
});
