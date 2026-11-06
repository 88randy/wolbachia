import { useTranslation } from "react-i18next";
import { Skeleton } from "./Skeleton";
import styles from "./ui.module.css";
/** `announce` false when a parent already exposes one loading status. */
export function CardSkeleton({ announce = true }: { announce?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      role={announce ? "status" : undefined}
      aria-label={announce ? t("states.loading.label") : undefined}
      className={styles.cardSkeleton}
    >
      <Skeleton />
      <Skeleton shape="chart" />
    </div>
  );
}
