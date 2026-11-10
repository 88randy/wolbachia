import { useTranslation } from "react-i18next";
import { EvaluationResult } from "./EvaluationResult";
import type { EvaluationFormModel } from "./use-evaluation-form";
export function EvaluationReceipt({ form }: { form: EvaluationFormModel }) {
  const { t } = useTranslation();
  const result = form.command.status?.receipt?.evaluation;
  if (!result) return null;
  return (
    <div role="status">
      <p>{t("evaluations.result.saved")}</p>
      <p>
        {t("evaluations.rubric.version")}
        {result.rubric_version_id}
      </p>
      <EvaluationResult result={result} />
    </div>
  );
}
