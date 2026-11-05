import { useTranslation } from "react-i18next";
import styles from "./catalogs.module.css";

interface Props {
  error: Error | null;
  onRetry: () => Promise<unknown>;
}

/** Cached catalogs keep the editor mounted while a failed refresh can be retried. */
export function CatalogRefreshNotice({ error, onRetry }: Props) {
  const { t } = useTranslation();
  if (error === null) return null;
  return (
    <div role="status" className={styles.note}>
      <p>{t("catalogs.page.refreshFailed")}</p>
      <button
        type="button"
        className={styles.action}
        onClick={() => {
          void onRetry();
        }}
      >
        {t("common.actions.retry")}
      </button>
    </div>
  );
}
