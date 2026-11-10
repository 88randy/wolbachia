import { useTranslation } from "react-i18next";
import styles from "./lab.module.css";
/** Always visible; scanner Enter uses the same form submission as the keyboard. */
export function CountShortcuts() {
  const { t } = useTranslation();
  return (
    <aside className={styles.shortcuts} aria-label={t("lab.shortcuts.title")}>
      <p>{t("lab.shortcuts.enter")}</p>
      <p>{t("lab.shortcuts.tab")}</p>
      <p>{t("lab.shortcuts.scan")}</p>
    </aside>
  );
}
