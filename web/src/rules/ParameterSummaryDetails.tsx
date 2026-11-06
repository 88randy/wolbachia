import { useTranslation } from "react-i18next";
import { useFormatDate } from "../format/use-formatters";
import type { RuleParameter } from "./rules-query";
import { SummaryItem } from "./SummaryItem";
import { CurrentParameterValue } from "./CurrentParameterValue";
import { useParameterRangeText } from "./use-parameter-range-text";
import styles from "./rules.module.css";
export function ParameterSummaryDetails({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const rangeText = useParameterRangeText(parameter);
  const dateOrNone = (iso: string | null) =>
    iso === null ? t("rules.cell.none") : formatDate(iso);
  return (
    <dl className={styles.summary}>
      <SummaryItem term={t("rules.summary.value")}>
        <CurrentParameterValue parameter={parameter} />
      </SummaryItem>
      <SummaryItem term={t("rules.summary.since")}>
        {dateOrNone(parameter.effective_from)}
      </SummaryItem>
      <SummaryItem term={t("rules.summary.next")}>
        {dateOrNone(parameter.next_change_at)}
      </SummaryItem>
      <SummaryItem term={t("rules.summary.range")}>{rangeText}</SummaryItem>
    </dl>
  );
}
