import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { classNames } from "../styles/class-names";
import styles from "./TopBar.module.css";

const LANGUAGE_CODE_LENGTH = 2;

/**
 * Switches es-MX <-> en without reloading. It shows the current language code; its accessible
 * name starts with that code (WCAG 2.5.3) and says what pressing it does. `className` lets the
 * sign-in pages give it a border.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const isSpanish = language === "es-MX";
  return (
    <button
      type="button"
      className={classNames(styles.iconButton, className)}
      aria-label={t(isSpanish ? "shell.language.toEnglish" : "shell.language.toSpanish")}
      onClick={() => {
        setLanguage(isSpanish ? "en" : "es-MX");
      }}
    >
      {language.slice(0, LANGUAGE_CODE_LENGTH).toUpperCase()}
    </button>
  );
}
