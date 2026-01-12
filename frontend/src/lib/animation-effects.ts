'use client';

import confetti from 'canvas-confetti';
import type { AnimationType } from '@/hooks/use-animations';

// ============= CONFETTI ANIMATION =============
export function fireConfetti(mini = false) {
  const count = mini ? 100 : 200;
  const defaults = {
    origin: mini ? { x: 0.9, y: 0.1 } : { y: 0.7 },
    zIndex: 9999,
    disableForReducedMotion: true,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  if (mini) {
    // Mini burst from top-right corner
    fire(0.4, { spread: 50, startVelocity: 35, colors: ['#f97316', '#fb923c', '#fdba74'] });
    setTimeout(() => {
      fire(0.3, { spread: 70, startVelocity: 25, colors: ['#22c55e', '#4ade80', '#86efac'] });
    }, 100);
    setTimeout(() => {
      fire(0.3, {
        spread: 90,
        startVelocity: 20,
        decay: 0.92,
        colors: ['#eab308', '#facc15', '#fde047'],
      });
    }, 200);
  } else {
    // Full celebration
    fire(0.25, { spread: 26, startVelocity: 55, colors: ['#f97316', '#fb923c', '#fdba74'] });
    fire(0.2, { spread: 60, colors: ['#22c55e', '#4ade80', '#86efac'] });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#eab308', '#facc15', '#fde047'],
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#f97316', '#22c55e', '#eab308'],
    });
    fire(0.1, { spread: 120, startVelocity: 45, colors: ['#ffffff', '#fef3c7'] });
  }
}

// ============= CONFETTI SOUND =============
export function playConfettiSound() {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    // Pleasant "pop" celebration sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
    oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    console.log('Audio not supported');
  }
}

// ============= THUNDER ANIMATION =============
export function fireThunder(mini = false) {
  // Add keyframes if not already added
  if (!document.getElementById('thunder-keyframes')) {
    const style = document.createElement('style');
    style.id = 'thunder-keyframes';
    style.textContent = `
      @keyframes thunderFlash {
        0% { opacity: 0.9; }
        10% { opacity: 0.3; }
        20% { opacity: 0.8; }
        30% { opacity: 0.2; }
        50% { opacity: 0.6; }
        100% { opacity: 0; }
      }
      @keyframes thunderFlashMini {
        0% { opacity: 0.7; }
        20% { opacity: 0.3; }
        40% { opacity: 0.5; }
        100% { opacity: 0; }
      }
      @keyframes lightningBolt {
        0% { opacity: 1; transform: scaleY(0); transform-origin: top; }
        20% { opacity: 1; transform: scaleY(1); }
        50% { opacity: 0.8; }
        100% { opacity: 0; transform: scaleY(1); }
      }
    `;
    document.head.appendChild(style);
  }

  if (mini) {
    // Mini version - flash in top-right corner only
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 200px;
      height: 200px;
      z-index: 9999;
      pointer-events: none;
      background: radial-gradient(circle at top right, rgba(255,255,255,0.8) 0%, rgba(96,165,250,0.4) 40%, transparent 70%);
      animation: thunderFlashMini 0.4s ease-out forwards;
    `;

    // Mini lightning bolt
    const bolt = document.createElement('div');
    bolt.innerHTML = `
      <svg viewBox="0 0 100 200" style="width: 40px; height: 80px; filter: drop-shadow(0 0 10px #fff) drop-shadow(0 0 20px #60a5fa);">
        <polygon points="50,0 30,80 45,80 25,200 70,70 50,70 70,0" fill="url(#lightning-gradient-mini)" />
        <defs>
          <linearGradient id="lightning-gradient-mini" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#60a5fa;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
        </defs>
      </svg>
    `;
    bolt.style.cssText = `
      position: fixed;
      top: 10px;
      right: 60px;
      z-index: 10000;
      pointer-events: none;
      animation: lightningBolt 0.4s ease-out forwards;
    `;

    document.body.appendChild(flash);
    document.body.appendChild(bolt);

    setTimeout(() => {
      flash.remove();
      bolt.remove();
    }, 500);
  } else {
    // Full screen version
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
      background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(200,220,255,0.7) 100%);
      animation: thunderFlash 0.6s ease-out forwards;
    `;

    const bolt = document.createElement('div');
    bolt.innerHTML = `
      <svg viewBox="0 0 100 200" style="width: 80px; height: 160px; filter: drop-shadow(0 0 20px #fff) drop-shadow(0 0 40px #60a5fa);">
        <polygon points="50,0 30,80 45,80 25,200 70,70 50,70 70,0" fill="url(#lightning-gradient)" />
        <defs>
          <linearGradient id="lightning-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#60a5fa;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
          </linearGradient>
        </defs>
      </svg>
    `;
    bolt.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      pointer-events: none;
      animation: lightningBolt 0.5s ease-out forwards;
    `;

    document.body.appendChild(flash);
    document.body.appendChild(bolt);

    setTimeout(() => {
      flash.remove();
      bolt.remove();
    }, 700);
  }
}

// ============= THUNDER SOUND =============
export function playThunderSound() {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    // Create noise for thunder rumble
    const bufferSize = audioContext.sampleRate * 2;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // Low-pass filter for deep rumble
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 1.5);

    // Gain envelope
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);

    noise.start(audioContext.currentTime);
    noise.stop(audioContext.currentTime + 1.5);

    // Add a low frequency oscillator for extra bass
    const osc = audioContext.createOscillator();
    const oscGain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(40, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, audioContext.currentTime + 1);

    oscGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

    osc.connect(oscGain);
    oscGain.connect(audioContext.destination);

    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 1);
  } catch {
    console.log('Audio not supported');
  }
}

// ============= FIREWORKS ANIMATION =============
export function fireFireworks(mini = false) {
  const duration = mini ? 800 : 2000;
  const animationEnd = Date.now() + duration;

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  if (mini) {
    // Mini version - single burst in top-right corner
    const defaults = {
      startVelocity: 20,
      spread: 360,
      ticks: 40,
      zIndex: 9999,
      origin: { x: 0.9, y: 0.1 },
    };

    confetti({
      ...defaults,
      particleCount: 30,
      colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00'],
    });
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 20,
        colors: ['#00ffff', '#0000ff', '#ff00ff'],
      });
    }, 150);
  } else {
    // Full version - multiple bursts
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'],
      });
    }, 250);
  }
}

// ============= FIREWORKS SOUND =============
export function playFireworksSound() {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    // Multiple pops at different times
    [0, 0.15, 0.35, 0.5, 0.7].forEach((delay) => {
      setTimeout(() => {
        const bufferSize = 4096;
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1000);
        }

        const noise = audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        noise.start();
        noise.stop(audioContext.currentTime + 0.3);
      }, delay * 1000);
    });
  } catch {
    console.log('Audio not supported');
  }
}

// ============= ELECTRIC SPARK ANIMATION =============
export function fireSpark(mini = false) {
  // Add keyframes if not already added
  if (!document.getElementById('spark-keyframes')) {
    const style = document.createElement('style');
    style.id = 'spark-keyframes';
    style.textContent = `
      @keyframes sparkMove {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        50% { opacity: 0.8; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
      }
      @keyframes sparkGlow {
        0%, 100% { box-shadow: 0 0 10px #60a5fa, 0 0 20px #3b82f6, 0 0 30px #2563eb; }
        50% { box-shadow: 0 0 20px #60a5fa, 0 0 40px #3b82f6, 0 0 60px #2563eb; }
      }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: none;
    overflow: hidden;
  `;

  // Center point - top-right for mini, screen center for full
  const centerX = mini ? window.innerWidth - 80 : window.innerWidth / 2;
  const centerY = mini ? 80 : window.innerHeight / 2;
  const sparkCount = mini ? 10 : 20;
  const distanceMultiplier = mini ? 0.5 : 1;

  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement('div');
    const angle = (i / sparkCount) * Math.PI * 2;
    const distance = (100 + Math.random() * 200) * distanceMultiplier;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const size = mini ? 2 + Math.random() * 4 : 4 + Math.random() * 6;
    const duration = 0.4 + Math.random() * 0.4;
    const delay = Math.random() * 0.2;

    spark.style.cssText = `
      position: absolute;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: linear-gradient(45deg, #60a5fa, #3b82f6);
      --tx: ${tx}px;
      --ty: ${ty}px;
      animation: sparkMove ${duration}s ease-out ${delay}s forwards, sparkGlow 0.2s ease-in-out infinite;
    `;
    container.appendChild(spark);
  }

  // Add electric arcs (fewer for mini)
  const arcCount = mini ? 2 : 5;
  for (let i = 0; i < arcCount; i++) {
    const arc = document.createElement('div');
    const startX = centerX + (Math.random() - 0.5) * (mini ? 50 : 100);
    const startY = centerY + (Math.random() - 0.5) * (mini ? 50 : 100);
    const svgSize = mini ? 100 : 200;

    arc.innerHTML = `
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 200 200">
        <path d="M100,100 Q${50 + Math.random() * 100},${Math.random() * 50} ${Math.random() * 200},${Math.random() * 200}" 
          stroke="url(#spark-gradient-${i})" stroke-width="${mini ? 1 : 2}" fill="none" 
          style="filter: drop-shadow(0 0 5px #60a5fa);">
          <animate attributeName="stroke-dasharray" from="0,1000" to="200,0" dur="0.3s" fill="freeze" />
        </path>
        <defs>
          <linearGradient id="spark-gradient-${i}">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="100%" stop-color="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
    `;
    arc.style.cssText = `
      position: absolute;
      left: ${startX - svgSize / 2}px;
      top: ${startY - svgSize / 2}px;
      opacity: 0.8;
    `;
    container.appendChild(arc);
  }

  document.body.appendChild(container);

  setTimeout(
    () => {
      container.remove();
    },
    mini ? 600 : 1000
  );
}

// ============= ELECTRIC SPARK SOUND =============
export function playSparkSound() {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    // Electric zap sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(2000, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);

    // Add crackle
    setTimeout(() => {
      const bufferSize = 2048;
      const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const noise = audioContext.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3000;

      const noiseGain = audioContext.createGain();
      noiseGain.gain.setValueAtTime(0.15, audioContext.currentTime);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioContext.destination);

      noise.start();
    }, 100);
  } catch {
    console.log('Audio not supported');
  }
}

// ============= COIN RAIN ANIMATION =============
export function fireCoins(mini = false) {
  // Add keyframes if not already added
  if (!document.getElementById('coin-keyframes')) {
    const style = document.createElement('style');
    style.id = 'coin-keyframes';
    style.textContent = `
      @keyframes coinFall {
        0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0.5; }
      }
      @keyframes coinFallMini {
        0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(200px) rotate(360deg); opacity: 0; }
      }
      @keyframes coinShine {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.3); }
      }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement('div');

  if (mini) {
    // Mini version - coins fall in top-right corner area
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 200px;
      height: 250px;
      z-index: 9999;
      pointer-events: none;
      overflow: hidden;
    `;

    const coinCount = 8;

    for (let i = 0; i < coinCount; i++) {
      const coin = document.createElement('div');
      const x = Math.random() * 180;
      const size = 12 + Math.random() * 10;
      const duration = 0.8 + Math.random() * 0.5;
      const delay = Math.random() * 0.3;

      coin.innerHTML = `
        <svg viewBox="0 0 40 40" width="${size}" height="${size}">
          <circle cx="20" cy="20" r="18" fill="url(#coin-gradient-mini)" stroke="#b45309" stroke-width="2"/>
          <text x="20" y="26" text-anchor="middle" font-size="18" font-weight="bold" fill="#78350f">₿</text>
          <defs>
            <linearGradient id="coin-gradient-mini" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fcd34d"/>
              <stop offset="50%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#d97706"/>
            </linearGradient>
          </defs>
        </svg>
      `;

      coin.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: -20px;
        animation: coinFallMini ${duration}s ease-in ${delay}s forwards, coinShine 0.3s ease-in-out infinite;
      `;

      container.appendChild(coin);
    }

    document.body.appendChild(container);

    setTimeout(() => {
      container.remove();
    }, 1500);
  } else {
    // Full version - coins fall across entire screen
    container.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
      overflow: hidden;
    `;

    const coinCount = 30;

    for (let i = 0; i < coinCount; i++) {
      const coin = document.createElement('div');
      const x = Math.random() * window.innerWidth;
      const size = 20 + Math.random() * 20;
      const duration = 1.5 + Math.random() * 1;
      const delay = Math.random() * 0.5;

      coin.innerHTML = `
        <svg viewBox="0 0 40 40" width="${size}" height="${size}">
          <circle cx="20" cy="20" r="18" fill="url(#coin-gradient)" stroke="#b45309" stroke-width="2"/>
          <text x="20" y="26" text-anchor="middle" font-size="18" font-weight="bold" fill="#78350f">₿</text>
          <defs>
            <linearGradient id="coin-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#fcd34d"/>
              <stop offset="50%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#d97706"/>
            </linearGradient>
          </defs>
        </svg>
      `;

      coin.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: -50px;
        animation: coinFall ${duration}s ease-in ${delay}s forwards, coinShine 0.3s ease-in-out infinite;
      `;

      container.appendChild(coin);
    }

    document.body.appendChild(container);

    setTimeout(() => {
      container.remove();
    }, 3000);
  }
}

// ============= COIN RAIN SOUND =============
export function playCoinsSound() {
  try {
    const audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();

    // Multiple coin clinks
    [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9].forEach((delay, index) => {
      setTimeout(() => {
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Higher pitched metallic sound
        const baseFreq = 2000 + Math.random() * 1000;
        osc.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, audioContext.currentTime + 0.1);
        osc.type = 'sine';

        gainNode.gain.setValueAtTime(0.1 - index * 0.01, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.15);
      }, delay * 1000);
    });
  } catch {
    console.log('Audio not supported');
  }
}

// ============= MAIN TRIGGER FUNCTION =============
export function triggerAnimation(type: AnimationType, playSound: boolean, mini = false) {
  if (type === 'none') return;

  switch (type) {
    case 'confetti':
      fireConfetti(mini);
      if (playSound) playConfettiSound();
      break;
    case 'thunder':
      fireThunder(mini);
      if (playSound) playThunderSound();
      break;
    case 'fireworks':
      fireFireworks(mini);
      if (playSound) playFireworksSound();
      break;
    case 'spark':
      fireSpark(mini);
      if (playSound) playSparkSound();
      break;
    case 'coins':
      fireCoins(mini);
      if (playSound) playCoinsSound();
      break;
  }
}

// Preview function for settings (always plays sound for preview)
export function previewAnimation(type: AnimationType) {
  triggerAnimation(type, true, false);
}
