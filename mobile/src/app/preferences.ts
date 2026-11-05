import { defaultLocale } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";

import { KV_KEYS } from "../db/kv-store.ts";
import type { KvStore } from "../db/kv-store.ts";
import type { ColorScheme } from "../theme/ThemeProvider.tsx";

export interface Preferences {
  readonly scheme: ColorScheme;
  readonly locale: Locale;
}

const LOCALES: readonly Locale[] = ["es-MX", "en"];

/** Light is the default; only an explicit saved choice turns dark on. */
export function parseScheme(value: string | null): ColorScheme {
  return value === "dark" ? "dark" : "light";
}

export function parseLocale(value: string | null): Locale {
  return LOCALES.find((locale) => locale === value) ?? defaultLocale;
}

export async function loadPreferences(kv: KvStore): Promise<Preferences> {
  const [scheme, locale] = await Promise.all([
    kv.get(KV_KEYS.themePreference),
    kv.get(KV_KEYS.locale),
  ]);
  return { scheme: parseScheme(scheme), locale: parseLocale(locale) };
}
