import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/use-theme";
import styles from "./Sidebar.module.css";
export function ThemeSegment() {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();
  return (
    <div className={styles.themeSegment} role="group" aria-label={t("shell.theme.label")}>
      <button
        type="button"
        aria-label={t("shell.theme.light")}
        aria-pressed={preference === "light"}
        onClick={() => {
          setPreference("light");
        }}
      >
        <Sun strokeWidth={1.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("shell.theme.dark")}
        aria-pressed={preference === "dark"}
        onClick={() => {
          setPreference("dark");
        }}
      >
        <Moon strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
