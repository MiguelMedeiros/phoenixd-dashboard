/// <reference lib="webworker" />

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  // Assets to precache (injected during build)
  precacheEntries: self.__SW_MANIFEST,

  // Activate new service worker immediately
  skipWaiting: true,

  // Take control of all clients immediately
  clientsClaim: true,

  // Enable navigation preload for faster navigation requests
  navigationPreload: true,

  // Custom cache prefix
  cacheId: 'phoenixd-dashboard',

  // Next.js optimized cache strategies
  runtimeCaching: defaultCache,

  // Fallback pages for offline scenarios
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

// Register all service worker event listeners
serwist.addEventListeners();
