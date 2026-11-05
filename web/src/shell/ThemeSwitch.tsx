import { useTranslation } from "react-i18next";
import { isThemePreference } from "../theme/theme";
import { useTheme } from "../theme/use-theme";
import utilities from "../styles/utilities.module.css";
import styles from "./TopBar.module.css";

/** Native, keyboard-accessible theme preference selector beside the language switch. */
export function ThemeSwitch() {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();
  return (
    <label>
      <span className={utilities.srOnly}>{t("shell.theme.label")}</span>
      <select
        className={styles.themeSelect}
        value={preference}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isThemePreference(next)) setPreference(next);
        }}
      >
        <option value="light">{t("shell.theme.light")}</option>
        <option value="dark">{t("shell.theme.dark")}</option>
        <option value="system">{t("shell.theme.system")}</option>
      </select>
    </label>
  );
}
