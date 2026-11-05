import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import styles from "./void-dialog.module.css";

/** A catalog failure or empty list blocks voiding until the user can choose a reason. */
export function VoidCatalogAlert({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={styles.field}>
      <p className={styles.hint}>{t("voiding.error.catalogUnavailable")}</p>
      <button type="button" className={buttons.button} onClick={onRetry}>
        {t("voiding.dialog.retry")}
      </button>
    </div>
  );
}
