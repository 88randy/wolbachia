import { useTranslation } from "react-i18next";
import { Skeleton } from "./Skeleton";
import styles from "./ui.module.css";
/** `announce` false when a parent already exposes one loading status. */
export function KpiSkeleton({
  cells = 5,
  announce = true,
}: {
  cells?: number;
  announce?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role={announce ? "status" : undefined}
      aria-label={announce ? t("states.loading.label") : undefined}
      className={styles.kpiSkeleton}
    >
      {Array.from({ length: cells }, (_, index) => (
        <div key={index}>
          <Skeleton />
          <Skeleton shape="value" />
        </div>
      ))}
    </div>
  );
}
