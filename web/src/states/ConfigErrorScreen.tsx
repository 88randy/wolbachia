import { useTranslation } from "react-i18next";
import styles from "./ConfigErrorScreen.module.css";

/** Shown instead of the app when the build is missing required configuration. */
export function ConfigErrorScreen() {
  const { t } = useTranslation();
  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>{t("states.config.title")}</h1>
      <p className={styles.body} role="alert">
        {t("states.config.missingApiUrl")}
      </p>
    </main>
  );
}
