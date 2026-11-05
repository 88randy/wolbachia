import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import type { Motorcycle } from "./fleet-query";
import { useFleetAuthor } from "./use-fleet-author";
import styles from "./fleet.module.css";
export function MotorcycleSummary({ motorcycle }: { motorcycle: Motorcycle }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const author = useFleetAuthor();
  return (
    <section className={styles.card} aria-label={t("fleet.tab.summary")}>
      <dl className={styles.summary}>
        <dt>{t("fleet.column.code")}</dt>
        <dd>{motorcycle.code}</dd>
        <dt>{t("fleet.column.plate")}</dt>
        <dd>{motorcycle.plate || t("fleet.summary.unknown")}</dd>
        <dt>{t("fleet.summary.createdAt")}</dt>
        <dd>{format(motorcycle.created_at)}</dd>
        <dt>{t("fleet.summary.createdBy")}</dt>
        <dd>{author(motorcycle.created_by)}</dd>
        {motorcycle.voided_at !== null && (
          <>
            <dt>{t("fleet.summary.voidedAt")}</dt>
            <dd>{format(motorcycle.voided_at)}</dd>
            <dt>{t("fleet.summary.voidedBy")}</dt>
            <dd>{author(motorcycle.voided_by)}</dd>
            <dt>{t("common.fields.voidReason")}</dt>
            <dd>{motorcycle.void_reason}</dd>
          </>
        )}
      </dl>
      <p className={styles.hint}>{t("fleet.summary.historyGap")}</p>
    </section>
  );
}
