import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";
import { Refreshing } from "../ui/Refreshing";
import { useReceptionSummary } from "./use-reception-summary";
import type { ReceptionSummaryCountProps } from "./use-reception-summary";
import styles from "./reception.module.css";

export function ReceptionSummaryCount(props: ReceptionSummaryCountProps) {
  const { t } = useTranslation();
  const summary = useReceptionSummary(props);
  return (
    <div className={styles.metric}>
      <span>{t(summary.labelKey)}</span>
      {summary.error ? (
        <ErrorState onRetry={summary.retry} />
      ) : summary.value === undefined ? (
        <Skeleton />
      ) : (
        <Link to="/lab/bags" search={summary.search}>
          {summary.value}
        </Link>
      )}
      {summary.isRefreshing && <Refreshing />}
    </div>
  );
}
