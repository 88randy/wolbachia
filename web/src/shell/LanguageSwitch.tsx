import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import styles from "./TopBar.module.css";

const LANGUAGE_CODE_LENGTH = 2;

/**
 * Switches es-MX <-> en without reloading. It shows the current language code; its accessible
 * name starts with that code (WCAG 2.5.3) and says what pressing it does.
 */
export function LanguageSwitch() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const isSpanish = language === "es-MX";
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={t(isSpanish ? "shell.language.toEnglish" : "shell.language.toSpanish")}
      onClick={() => {
        setLanguage(isSpanish ? "en" : "es-MX");
      }}
    >
      {language.slice(0, LANGUAGE_CODE_LENGTH).toUpperCase()}
    </button>
  );
}
