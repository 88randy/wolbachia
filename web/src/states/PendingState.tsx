import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../ui/CardSkeleton";
import { KpiSkeleton } from "../ui/KpiSkeleton";
import styles from "./PendingState.module.css";

/** Route loading: one announced status around content-shaped skeletons, never a blank page. */
export function PendingState() {
  const { t } = useTranslation();
  return (
    <div className={styles.pending} role="status" aria-label={t("states.loading.label")}>
      <KpiSkeleton announce={false} />
      <CardSkeleton announce={false} />
    </div>
  );
}
