import { useTranslation } from "react-i18next";
import { Skeleton } from "./Skeleton";
import styles from "./ui.module.css";
export function KpiSkeleton({ cells = 5 }: { cells?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("states.loading.label")} className={styles.kpiSkeleton}>
      {Array.from({ length: cells }, (_, index) => (
        <div key={index}>
          <Skeleton />
          <Skeleton shape="value" />
        </div>
      ))}
    </div>
  );
}
