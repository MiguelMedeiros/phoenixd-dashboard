import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = withSerwistInit({
  // Source service worker file
  swSrc: 'src/app/sw.ts',
  // Output destination in public directory
  swDest: 'public/sw.js',
  // Disable only if explicitly set (allows testing PWA in dev)
  disable: process.env.DISABLE_PWA === 'true',
  // Automatically register service worker
  register: true,
  // Service worker scope
  scope: '/',
  // Reload page when online after offline
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, './'),
};

export default withSerwist(withNextIntl(nextConfig));
