import { defaultLocale } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { isLocale } from "./locale";

/** Current language and a setter that switches it without reloading the page. */
export function useLanguage(): { language: Locale; setLanguage: (language: Locale) => void } {
  const { i18n } = useTranslation();
  const language = isLocale(i18n.language) ? i18n.language : defaultLocale;
  return {
    language,
    setLanguage: (next) => {
      void i18n.changeLanguage(next);
    },
  };
}
