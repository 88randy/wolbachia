import { defaultLocale, messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { readStored, STORAGE_KEYS } from "../storage/safe-storage";

/** Every locale the shared catalogs provide. */
export const LOCALES = Object.keys(messages) as Locale[];

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/** Last language the user chose in this browser, or the default (es-MX). */
export function getInitialLocale(): Locale {
  const stored = readStored(STORAGE_KEYS.language);
  return isLocale(stored) ? stored : defaultLocale;
}
