import { defaultLocale, messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { createInstance } from "i18next";
import type { i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { writeStored, STORAGE_KEYS } from "../storage/safe-storage";
import { isLocale, LOCALES } from "./locale";

function buildResources() {
  return Object.fromEntries(LOCALES.map((locale) => [locale, { translation: messages[locale] }]));
}

/** Keeps `<html lang>` (screen readers, hyphenation) and the saved preference in step. */
function followLanguage(instance: I18n): void {
  instance.on("languageChanged", (language) => {
    if (!isLocale(language)) return;
    document.documentElement.lang = language;
    writeStored(STORAGE_KEYS.language, language);
  });
}

/**
 * Creates the i18next instance fed with the shared catalogs of `@wolbachia/i18n`.
 * Keys are flat strings with dots (`shell.nav.home`) and placeholders are `{name}`, so the
 * key and namespace separators are off and the interpolation delimiters are braces.
 */
export async function setupI18n(language: Locale): Promise<I18n> {
  const instance = createInstance();
  followLanguage(instance);
  await instance.use(initReactI18next).init({
    resources: buildResources(),
    lng: language,
    fallbackLng: defaultLocale,
    supportedLngs: LOCALES,
    load: "currentOnly",
    keySeparator: false,
    nsSeparator: false,
    interpolation: { prefix: "{", suffix: "}", escapeValue: false },
  });
  return instance;
}
