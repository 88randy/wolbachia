import { MotorcycleVoidSummary } from "./MotorcycleVoidSummary";
import { Card } from "../ui/Card";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import type { MotorcycleDetail } from "./fleet-query";
import { MotorcycleMetricsSummary } from "./MotorcycleMetricsSummary";
import { useFleetAuthor } from "./use-fleet-author";
import styles from "./fleet.module.css";
export function MotorcycleSummary({ motorcycle }: { motorcycle: MotorcycleDetail }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const author = useFleetAuthor();
  return (
    <Card title={t("fleet.tab.summary")}>
      <dl className={styles.summary}>
        <dt>{t("fleet.column.code")}</dt>
        <dd className={styles.code}>{motorcycle.code}</dd>
        <dt>{t("fleet.column.plate")}</dt>
        <dd className={styles.code}>{motorcycle.plate || t("fleet.summary.unknown")}</dd>
        <dt>{t("fleet.summary.createdAt")}</dt>
        <dd className={styles.timestamp}>{format(motorcycle.created_at)}</dd>
        <dt>{t("fleet.summary.createdBy")}</dt>
        <dd>{author(motorcycle.created_by)}</dd>
        <MotorcycleVoidSummary motorcycle={motorcycle} />
      </dl>
      <MotorcycleMetricsSummary motorcycle={motorcycle} />
      <p className={styles.hint}>{t("fleet.summary.historyGap")}</p>
    </Card>
  );
}
