import type { Locale } from "@wolbachia/i18n";
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";

import { I18nProvider } from "../i18n/I18nProvider.tsx";
import { ThemeProvider } from "../theme/ThemeProvider.tsx";
import type { ColorScheme } from "../theme/ThemeProvider.tsx";
import { resolveScheme } from "./preferences.ts";
import { DEFAULT_PREFERENCES } from "./preferences.ts";
import { PreferenceStore } from "./preference-store.ts";
import type { Preferences, ThemePreference } from "./preferences.ts";
import { useServices } from "./services-context.ts";

interface PreferencesValue extends Preferences {
  readonly resolvedScheme: ColorScheme;
  readonly setScheme: (scheme: ThemePreference) => void;
  readonly setLocale: (locale: Locale) => void;
  readonly setTextSize: (textSize: Preferences["textSize"]) => void;
  readonly hasError: boolean;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

interface PreferencesProviderProps {
  readonly initial: Preferences;
  readonly children: ReactNode;
}

/** Holds the language and the theme, saves a change to the phone, and feeds both providers. */
function usePreferenceStore(initial: Preferences): PreferenceStore {
  const { kv, auth } = useServices();
  const { profile } = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const owner =
    profile?.userId && profile.organization ? `${profile.organization.id}:${profile.userId}` : null;
  const firstOwner = useRef(owner);
  const store = useMemo(
    () =>
      new PreferenceStore(kv, owner, firstOwner.current === owner ? initial : DEFAULT_PREFERENCES),
    [kv, owner, initial],
  );
  useEffect(() => {
    void store.load();
  }, [store]);
  return store;
}
function usePreferenceState(initial: Preferences): PreferencesValue {
  const store = usePreferenceStore(initial);
  const preferences = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const systemScheme = useColorScheme();
  const resolvedScheme = resolveScheme(preferences.scheme, systemScheme);
  return useMemo(
    () => ({
      ...preferences,
      resolvedScheme,
      setScheme: (scheme: ThemePreference) => {
        void store.change({ scheme });
      },
      setLocale: (locale: Locale) => {
        void store.change({ locale });
      },
      setTextSize: (textSize: Preferences["textSize"]) => {
        void store.change({ textSize });
      },
    }),
    [preferences, resolvedScheme, store],
  );
}

/** Persisted choice and live system appearance feed both application providers. */
export function PreferencesProvider({ initial, children }: PreferencesProviderProps) {
  const value = usePreferenceState(initial);
  return (
    <PreferencesContext.Provider value={value}>
      <ThemeProvider scheme={value.resolvedScheme} textScale={value.textSize === "large" ? 1.3 : 1}>
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
