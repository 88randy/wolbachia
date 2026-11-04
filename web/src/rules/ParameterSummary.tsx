import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFormatDate, useFormatNumber } from "../format/use-formatters";
import { NotConfiguredBadge } from "./NotConfiguredBadge";
import { useParameterLabels } from "./parameter-labels";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";

function SummaryItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.summaryItem}>
      <dt className={styles.term}>{term}</dt>
      <dd className={styles.detail}>{children}</dd>
    </div>
  );
}

/** The allowed values, written for the limits that exist (a bound can be missing). */
function useRangeText(parameter: RuleParameter): string {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const { min_value: min, max_value: max } = parameter;
  if (min !== null && max !== null) {
    return t("rules.range.between", { min: formatNumber(min), max: formatNumber(max) });
  }
  if (min !== null) return t("rules.range.atLeast", { min: formatNumber(min) });
  if (max !== null) return t("rules.range.atMost", { max: formatNumber(max) });
  return t("rules.range.none");
}

/** The value in force with its unit; a parameter with no version is "not configured", never 0. */
function CurrentValue({ parameter }: { parameter: RuleParameter }) {
  const labels = useParameterLabels();
  const formatNumber = useFormatNumber();
  if (parameter.value === null) return <NotConfiguredBadge />;
  return (
    <span className={styles.bigValue}>
      {formatNumber(parameter.value)} {labels.unit(parameter.unit)}
    </span>
  );
}

/** The value in force now, since when, what is scheduled next and what a new value may be. */
export function ParameterSummary({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const rangeText = useRangeText(parameter);
  const dateOrNone = (iso: string | null) =>
    iso === null ? t("rules.cell.none") : formatDate(iso);
  return (
    <section className={styles.card} aria-labelledby="rule-summary-title">
      <h2 id="rule-summary-title" className={styles.cardTitle}>
        {t("rules.summary.title")}
      </h2>
      <dl className={styles.summary}>
        <SummaryItem term={t("rules.summary.value")}>
          <CurrentValue parameter={parameter} />
        </SummaryItem>
        <SummaryItem term={t("rules.summary.since")}>
          {dateOrNone(parameter.effective_from)}
        </SummaryItem>
        <SummaryItem term={t("rules.summary.next")}>
          {dateOrNone(parameter.next_change_at)}
        </SummaryItem>
        <SummaryItem term={t("rules.summary.range")}>{rangeText}</SummaryItem>
      </dl>
    </section>
  );
}
