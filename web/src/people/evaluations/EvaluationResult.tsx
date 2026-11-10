import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../../ui/Card";
import { StatusPill } from "../../ui/StatusPill";
import { OUTCOME_KEYS } from "./evaluation-labels";
import styles from "./evaluations.module.css";
type Result = Pick<Schemas["EvaluationResult"], "outcome" | "score" | "completion_sequence">;
export function EvaluationResult({ result }: { result: Result }) {
  const { t } = useTranslation();
  const tone = result.outcome === "pass" ? "success" : "warning";
  return (
    <Card title={t("evaluations.result.title")}>
      <StatusPill tone={tone}>{t(OUTCOME_KEYS[result.outcome])}</StatusPill>
      <dl className={styles.facts}>
        <dt>{t("evaluations.result.score")}</dt>
        <dd>{result.score ?? t("evaluations.field.unanswered")}</dd>
        <dt>{t("evaluations.result.sequence")}</dt>
        <dd>{result.completion_sequence ?? t("evaluations.field.unanswered")}</dd>
      </dl>
    </Card>
  );
}
