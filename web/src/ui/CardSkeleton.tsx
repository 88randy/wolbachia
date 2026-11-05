import { useTranslation } from "react-i18next";
import { Skeleton } from "./Skeleton";
import styles from "./ui.module.css";
export function CardSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("states.loading.label")} className={styles.cardSkeleton}>
      <Skeleton />
      <Skeleton shape="chart" />
    </div>
  );
}
