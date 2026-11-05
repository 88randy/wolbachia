import { defaultLocale } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { createTranslate } from "./translate.ts";
import type { Translate } from "./translate.ts";

interface I18nContextValue {
  readonly locale: Locale;
  readonly t: Translate;
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  t: createTranslate(defaultLocale),
});

interface I18nProviderProps {
  readonly locale: Locale;
  readonly children: ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const value = useMemo(() => ({ locale, t: createTranslate(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The `t(key, params)` function of the current language. */
export function useT(): Translate {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
