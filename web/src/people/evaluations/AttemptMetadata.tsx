import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { nameOrDash } from "../../lookups/use-reference-names";
import styles from "./evaluations.module.css";
export function AttemptMetadata({ attempt }: { attempt: Schemas["EvaluationAttemptRead"] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const reason = attempt.reason ? `: ${attempt.reason}` : t("evaluations.history.unavailable");
  return (
    <dl className={styles.facts}>
      <dt>{t("evaluations.field.observed")}</dt>
      <dd>{format(attempt.observed_at)}</dd>
      <dt>{t("evaluations.history.author")}</dt>
      <dd>{nameOrDash(attempt.created_by_name)}</dd>
      <dt>{t("evaluations.history.recorded")}</dt>
      <dd>{format(attempt.created_at)}</dd>
      <dt>{t("evaluations.history.reason")}</dt>
      <dd>
        {attempt.reason_code}
        {reason}
      </dd>
    </dl>
  );
}
