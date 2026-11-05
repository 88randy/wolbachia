import type { Locale } from "@wolbachia/i18n";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { I18nProvider } from "../i18n/I18nProvider.tsx";
import { KV_KEYS } from "../db/kv-store.ts";
import { ThemeProvider } from "../theme/ThemeProvider.tsx";
import type { ColorScheme } from "../theme/ThemeProvider.tsx";
import type { Preferences } from "./preferences.ts";
import { useServices } from "./services-context.ts";

interface PreferencesValue extends Preferences {
  readonly setScheme: (scheme: ColorScheme) => void;
  readonly setLocale: (locale: Locale) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

interface PreferencesProviderProps {
  readonly initial: Preferences;
  readonly children: ReactNode;
}

/** Holds the language and the theme, saves a change to the phone, and feeds both providers. */
export function PreferencesProvider({ initial, children }: PreferencesProviderProps) {
  const { kv } = useServices();
  const [preferences, setPreferences] = useState(initial);
  const setScheme = useCallback(
    (scheme: ColorScheme) => {
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
  const value = useMemo(
    () => ({ ...preferences, setScheme, setLocale }),
    [preferences, setScheme, setLocale],
  );
  return (
    <PreferencesContext.Provider value={value}>
      <ThemeProvider scheme={preferences.scheme}>
        <I18nProvider locale={preferences.locale}>{children}</I18nProvider>
      </ThemeProvider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (value === null) throw new Error("usePreferences was called outside PreferencesProvider.");
  return value;
}
