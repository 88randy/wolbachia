import { useTranslation } from "react-i18next";
import styles from "./PendingState.module.css";

/** Skeleton shown while a route loads: never a blank page. Same shape as a page header + cards. */
export function PendingState() {
  const { t } = useTranslation();
  return (
    <div
      className={styles.pending}
      role="status"
      aria-busy="true"
      aria-label={t("states.loading.label")}
    >
      <div className={styles.title} />
      <div className={styles.cards}>
        <div className={styles.card} />
        <div className={styles.card} />
        <div className={styles.card} />
      </div>
    </div>
  );
}
