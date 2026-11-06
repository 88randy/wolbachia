import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/use-theme";
import { useResolvedTheme } from "../theme/use-resolved-theme";
import { getResolvedTheme } from "../theme/resolved-theme";
import styles from "./TopBar.module.css";

/** One control: System follows until the first explicit light/dark toggle. */
export function ThemeSwitch() {
  const { t } = useTranslation();
  const { setPreference } = useTheme();
  const theme = useResolvedTheme();
  return (
    <button
      type="button"
      role="switch"
      className={styles.themeSwitch}
      aria-label={t("shell.theme.dark")}
      aria-checked={theme === "dark"}
      onClick={() => {
        setPreference(getResolvedTheme() === "dark" ? "light" : "dark");
      }}
    >
      <span className={styles.sunSymbol} aria-hidden="true">
        <Sun strokeWidth={1.5} />
      </span>
      <span className={styles.moonSymbol} aria-hidden="true">
        <Moon strokeWidth={1.5} />
      </span>
    </button>
  );
}
