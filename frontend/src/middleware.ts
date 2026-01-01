import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  // - API routes (/api)
  // - Next.js internals (/_next, /_vercel)
  // - Static files (files with extensions like .ico, .png, .jpg, etc.)
  matcher: [
    // Match root
    '/',
    // Match all paths except api, _next, _vercel, and static files
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
