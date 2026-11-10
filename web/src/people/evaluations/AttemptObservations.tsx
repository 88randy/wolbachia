import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { observationsOf } from "./evaluation-domain";
import styles from "./evaluations.module.css";
export function AttemptObservations({ attempt }: { attempt: Schemas["EvaluationAttemptRead"] }) {
  const { t } = useTranslation();
  const observations = [
    ...observationsOf(attempt.section_scores),
    ...observationsOf(attempt.critical_responses),
  ];
  return (
    <details>
      <summary>{t("evaluations.history.raw")}</summary>
      <dl className={styles.facts}>
        {observations.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value || t("evaluations.field.unanswered")}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
