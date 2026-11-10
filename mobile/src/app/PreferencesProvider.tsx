import type { Locale } from "@wolbachia/i18n";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";

import { I18nProvider } from "../i18n/I18nProvider.tsx";
import { KV_KEYS } from "../db/kv-store.ts";
import { ThemeProvider } from "../theme/ThemeProvider.tsx";
import type { ColorScheme } from "../theme/ThemeProvider.tsx";
import { resolveScheme } from "./preferences.ts";
import type { Preferences, ThemePreference } from "./preferences.ts";
import { useServices } from "./services-context.ts";

interface PreferencesValue extends Preferences {
  readonly resolvedScheme: ColorScheme;
  readonly setScheme: (scheme: ThemePreference) => void;
  readonly setLocale: (locale: Locale) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

interface PreferencesProviderProps {
  readonly initial: Preferences;
  readonly children: ReactNode;
}

/** Holds the language and the theme, saves a change to the phone, and feeds both providers. */
function usePreferenceState(initial: Preferences): PreferencesValue {
  const { kv } = useServices();
  const [preferences, setPreferences] = useState(initial);
  const systemScheme = useColorScheme();
  const resolvedScheme = resolveScheme(preferences.scheme, systemScheme);
  const setScheme = useCallback(
    (scheme: ThemePreference) => {
      setPreferences((previous) => ({ ...previous, scheme }));
      void kv.set(KV_KEYS.themePreference, scheme);
    },
    [kv],
  );
  const setLocale = useCallback(
    (locale: Locale) => {
      setPreferences((previous) => ({ ...previous, locale }));
      void kv.set(KV_KEYS.locale, locale);
    },
    [kv],
  );
  return useMemo(
    () => ({ ...preferences, resolvedScheme, setScheme, setLocale }),
    [preferences, resolvedScheme, setScheme, setLocale],
  );
}

/** Persisted choice and live system appearance feed both application providers. */
export function PreferencesProvider({ initial, children }: PreferencesProviderProps) {
  const value = usePreferenceState(initial);
  return (
    <PreferencesContext.Provider value={value}>
      <ThemeProvider scheme={value.resolvedScheme}>
        <I18nProvider locale={value.locale}>{children}</I18nProvider>
      </ThemeProvider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (value === null) throw new Error("usePreferences was called outside PreferencesProvider.");
  return value;
}
