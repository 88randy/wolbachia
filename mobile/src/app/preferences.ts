import { defaultLocale } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";

import { KV_KEYS } from "../db/kv-store.ts";
import type { KvStore } from "../db/kv-store.ts";
import type { ColorScheme } from "../theme/ThemeProvider.tsx";

export type ThemePreference = ColorScheme | "system";

export interface Preferences {
  readonly scheme: ThemePreference;
  readonly locale: Locale;
  readonly textSize: "system" | "large";
}

export const DEFAULT_PREFERENCES: Preferences = {
  scheme: "light",
  locale: defaultLocale,
  textSize: "system",
};

const LOCALES: readonly Locale[] = ["es-MX", "en"];

/** Keep explicit choices; an unset/unknown value uses the light theme (owner decision, 2026-11-10). */
export function parseScheme(value: string | null): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}

export function resolveScheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ColorScheme {
  return preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;
}

export function parseLocale(value: string | null): Locale {
  return LOCALES.find((locale) => locale === value) ?? defaultLocale;
}

export async function loadPreferences(kv: KvStore): Promise<Preferences> {
  const [scheme, locale] = await Promise.all([
    kv.get(KV_KEYS.themePreference),
    kv.get(KV_KEYS.locale),
  ]);
  return { scheme: parseScheme(scheme), locale: parseLocale(locale), textSize: "system" };
}
