import { useId } from "react";
import { useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useFormatCalendarDate, useFormatDate, useFormatNumber } from "../format/use-formatters";
import { classNames } from "../styles/class-names";
import { NotConfiguredBadge } from "./NotConfiguredBadge";
import { useParameterLabels } from "./parameter-labels";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";
import { boundsOf, validValueOf } from "./version-schema";
import type { VersionValues } from "./version-schema";

interface ComparisonProps {
  parameter: RuleParameter;
  control: Control<VersionValues>;
}

/** What applies today: the value in force and since when (a parameter with no version has none). */
function Before({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const formatDate = useFormatDate();
  const labels = useParameterLabels();
  const { value, effective_from: since } = parameter;
  return (
    <div className={styles.before}>
      <p className={styles.term}>{t("rules.compare.before")}</p>
      {value === null ? (
        <NotConfiguredBadge />
      ) : (
        <p className={classNames(styles.bigValue, styles.struck)}>
          {labels.valueText(parameter, value, formatNumber)}
        </p>
      )}
      {since !== null && (
        <p className={styles.detail}>{t("rules.compare.from", { date: formatDate(since) })}</p>
      )}
    </div>
  );
}

/** The value being typed, and the day it would start when one is chosen. */
function After({ text, date }: { text: string; date: string }) {
  const { t } = useTranslation();
  const formatCalendarDate = useFormatCalendarDate();
  return (
    <div className={styles.after}>
      <p className={styles.term}>{t("rules.compare.after")}</p>
      <p className={styles.bigValue}>{text}</p>
      {date !== "" && (
        <p className={styles.detail}>
          {t("rules.compare.from", { date: formatCalendarDate(date) })}
        </p>
      )}
    </div>
  );
}

/**
 * Before and after of the version being typed (design W62). It appears once the value is valid, so
 * it never compares against something the server would refuse. Before is struck through and each
 * side is named, so the contrast never rests on color alone.
 */
export function VersionComparison({ parameter, control }: ComparisonProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const labels = useParameterLabels();
  const formatNumber = useFormatNumber();
  const [raw, date] = useWatch({ control, name: ["value", "effectiveFrom"] });
  const next = validValueOf(raw, boundsOf(parameter));
  if (next === null) return null;
  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.term}>
        {t("rules.compare.title")}
      </h3>
      <div className={styles.compare}>
        <Before parameter={parameter} />
        <After text={labels.valueText(parameter, next, formatNumber)} date={date} />
      </div>
    </section>
  );
}
