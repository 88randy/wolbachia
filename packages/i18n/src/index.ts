/**
 * @wolbachia/i18n: shared message catalogs for mobile and web.
 * Clients translate by key; the API never returns user-facing text.
 */
import { en } from './locales/en.ts';
import { esMX } from './locales/es-MX.ts';
import type { MessageKey } from './locales/es-MX.ts';

export type { MessageKey } from './locales/es-MX.ts';

/** Supported locales. */
export type Locale = 'es-MX' | 'en';

/** Locale used when the user has not chosen one. */
export const defaultLocale: Locale = 'es-MX';

/** Message text by locale and key. Placeholders are written `{name}`. */
export const messages: Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>> = {
  'es-MX': esMX,
  en,
};
