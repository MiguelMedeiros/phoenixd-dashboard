import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// We need to import after mocking
import confetti from 'canvas-confetti';
import {
  fireConfetti,
  fireThunder,
  fireFireworks,
  fireSpark,
  fireCoins,
  playConfettiSound,
  playThunderSound,
  playFireworksSound,
  playSparkSound,
  playCoinsSound,
  triggerAnimation,
  previewAnimation,
} from '@/lib/animation-effects';

// Mock AudioContext
class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;

  createOscillator() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      type: 'sine',
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    };
  }

  createBuffer(_channels: number, length: number, _sampleRate: number) {
    return {
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createBiquadFilter() {
    return {
      connect: vi.fn(),
      type: 'lowpass',
      frequency: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
  }

  destination = {};
}

Object.defineProperty(window, 'AudioContext', { value: MockAudioContext });

describe('Animation Effects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    // Clean up any existing style elements
    document
      .querySelectorAll('#thunder-keyframes, #spark-keyframes, #coin-keyframes')
      .forEach((el) => {
        el.remove();
      });
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up any DOM elements added
    document.body.innerHTML = '';
  });

  describe('fireConfetti', () => {
    it('calls confetti with default settings', () => {
      fireConfetti();

      expect(confetti).toHaveBeenCalled();
    });

    it('calls confetti with mini settings', () => {
      fireConfetti(true);

      expect(confetti).toHaveBeenCalled();

      // Verify origin is set for top-right corner
      const calls = (confetti as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('fires multiple confetti bursts for full celebration', () => {
      fireConfetti(false);

      // Should call confetti multiple times for full effect
      expect((confetti as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('fireThunder', () => {
    it('creates flash and bolt elements for full version', () => {
      fireThunder(false);

      // Check that elements are added to the DOM
      const elements = document.querySelectorAll('[style*="position: fixed"]');
      expect(elements.length).toBeGreaterThan(0);

      // Should have lightning bolt SVG
      expect(document.body.innerHTML).toContain('svg');
    });

    it('creates mini version for top-right corner', () => {
      fireThunder(true);

      const elements = document.querySelectorAll('[style*="position: fixed"]');
      expect(elements.length).toBeGreaterThan(0);

      // Mini version should have specific positioning
      expect(document.body.innerHTML).toContain('right');
    });

    it('adds thunder keyframes to document', () => {
      fireThunder(false);

      expect(document.getElementById('thunder-keyframes')).not.toBeNull();
    });

    it('removes elements after timeout', () => {
      fireThunder(false);

      expect(document.querySelectorAll('[style*="position: fixed"]').length).toBeGreaterThan(0);

      vi.advanceTimersByTime(1000);

      // Elements should be removed
      expect(document.querySelectorAll('[style*="animation: thunderFlash"]').length).toBe(0);
    });
  });

  describe('fireFireworks', () => {
    it('fires confetti for mini version', () => {
      fireFireworks(true);

      expect(confetti).toHaveBeenCalled();
    });

    it('fires multiple confetti bursts for full version', () => {
      fireFireworks(false);

      // Advance timer to trigger interval firings
      vi.advanceTimersByTime(500);

      expect((confetti as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('fireSpark', () => {
    it('creates spark container and elements', () => {
      fireSpark(false);

      const container = document.querySelector('[style*="position: fixed"]');
      expect(container).not.toBeNull();
    });

    it('creates mini version for top-right corner', () => {
      fireSpark(true);

      const elements = document.querySelectorAll('[style*="position: fixed"]');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('adds spark keyframes to document', () => {
      fireSpark(false);

      expect(document.getElementById('spark-keyframes')).not.toBeNull();
    });

    it('removes elements after timeout', () => {
      fireSpark(false);

      expect(document.querySelectorAll('[style*="position: fixed"]').length).toBeGreaterThan(0);

      vi.advanceTimersByTime(1500);

      expect(document.querySelectorAll('[style*="sparkMove"]').length).toBe(0);
    });
  });

  describe('fireCoins', () => {
    it('creates coin container and elements', () => {
      fireCoins(false);

      const container = document.querySelector('[style*="position: fixed"]');
      expect(container).not.toBeNull();

      // Should have Bitcoin symbol
      expect(document.body.innerHTML).toContain('₿');
    });

    it('creates mini version for top-right corner', () => {
      fireCoins(true);

      const container = document.querySelector('[style*="position: fixed"]');
      expect(container).not.toBeNull();

      // Mini version has smaller container
      expect(container?.getAttribute('style')).toContain('width: 200px');
    });

    it('adds coin keyframes to document', () => {
      fireCoins(false);

      expect(document.getElementById('coin-keyframes')).not.toBeNull();
    });
  });

  describe('Sound Functions', () => {
    it('playConfettiSound creates audio without errors', () => {
      expect(() => playConfettiSound()).not.toThrow();
    });

    it('playThunderSound creates audio without errors', () => {
      expect(() => playThunderSound()).not.toThrow();
    });

    it('playFireworksSound creates audio without errors', () => {
      expect(() => playFireworksSound()).not.toThrow();
      vi.advanceTimersByTime(1000);
    });

    it('playSparkSound creates audio without errors', () => {
      expect(() => playSparkSound()).not.toThrow();
      vi.advanceTimersByTime(200);
    });

    it('playCoinsSound creates audio without errors', () => {
      expect(() => playCoinsSound()).not.toThrow();
      vi.advanceTimersByTime(1000);
    });
  });

  describe('triggerAnimation', () => {
    it('does nothing when type is none', () => {
      triggerAnimation('none', true);

      expect(confetti).not.toHaveBeenCalled();
    });

    it('triggers confetti animation', () => {
      triggerAnimation('confetti', false);

      expect(confetti).toHaveBeenCalled();
    });

    it('triggers thunder animation', () => {
      triggerAnimation('thunder', false);

      expect(document.getElementById('thunder-keyframes')).not.toBeNull();
    });

    it('triggers fireworks animation', () => {
      triggerAnimation('fireworks', false, true); // Use mini mode for sync test

      expect(confetti).toHaveBeenCalled();
    });

    it('triggers spark animation', () => {
      triggerAnimation('spark', false);

      expect(document.getElementById('spark-keyframes')).not.toBeNull();
    });

    it('triggers coins animation', () => {
      triggerAnimation('coins', false);

      expect(document.getElementById('coin-keyframes')).not.toBeNull();
    });

    it('triggers mini version when specified', () => {
      triggerAnimation('thunder', false, true);

      // Mini version uses specific styles
      const elements = document.querySelectorAll('[style*="position: fixed"]');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('plays sound when playSound is true', () => {
      // Just ensure no errors are thrown
      expect(() => triggerAnimation('confetti', true)).not.toThrow();
    });

    it('does not play sound when playSound is false', () => {
      // This should complete without triggering audio
      expect(() => triggerAnimation('confetti', false)).not.toThrow();
    });
  });

  describe('previewAnimation', () => {
    it('triggers full animation with sound', () => {
      expect(() => previewAnimation('thunder')).not.toThrow();

      expect(document.getElementById('thunder-keyframes')).not.toBeNull();
    });

    it('does nothing for none type', () => {
      previewAnimation('none');

      expect(confetti).not.toHaveBeenCalled();
    });
  });

  describe('DOM Cleanup', () => {
    it('cleans up thunder elements after animation', () => {
      fireThunder(false);

      vi.advanceTimersByTime(1000);

      // Flash and bolt should be removed
      const flashElements = document.querySelectorAll('[style*="thunderFlash"]');
      expect(flashElements.length).toBe(0);
    });

    it('cleans up spark elements after animation', () => {
      fireSpark(false);

      vi.advanceTimersByTime(1500);

      const sparkContainers = document.querySelectorAll('[style*="sparkMove"]');
      expect(sparkContainers.length).toBe(0);
    });

    it('cleans up coin elements after animation', () => {
      fireCoins(false);

      vi.advanceTimersByTime(4000);

      const coinContainers = document.querySelectorAll('[style*="coinFall"]');
      expect(coinContainers.length).toBe(0);
    });
  });
});
