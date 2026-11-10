import { useTranslation } from "react-i18next";
import { Wordmark } from "../shell/Wordmark";
import styles from "./auth.module.css";

/** Left panel of the public pages: brand, what the platform is, and the regulatory reference. */
export function AuthBrandPanel() {
  const { t } = useTranslation();
  return (
    <div className={styles.brandPanel}>
      <div className={styles.brand}>
        <Wordmark />
      </div>
      <div className={styles.brandCopy}>
        <p className={styles.eyebrow}>{t("auth.login.program")}</p>
        <p className={styles.headline}>{t("auth.login.headline")}</p>
        <p className={styles.tagline}>{t("auth.login.tagline")}</p>
      </div>
      <p className={styles.standards}>{t("auth.login.standards")}</p>
    </div>
  );
}
