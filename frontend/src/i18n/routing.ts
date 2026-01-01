import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'pt', 'es', 'fr', 'de', 'zh', 'ko', 'ja', 'ru', 'ar', 'hi'] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  ko: '한국어',
  ja: '日本語',
  ru: 'Русский',
  ar: 'العربية',
  hi: 'हिन्दी',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  pt: '🇧🇷',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  zh: '🇨🇳',
  ko: '🇰🇷',
  ja: '🇯🇵',
  ru: '🇷🇺',
  ar: '🇸🇦',
  hi: '🇮🇳',
};

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
