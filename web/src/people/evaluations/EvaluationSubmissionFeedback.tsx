import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { EvaluationFormModel } from "./use-evaluation-form";
export function EvaluationSubmissionFeedback({ form }: { form: EvaluationFormModel }) {
  const { t } = useTranslation();
  if (form.command.status?.phase === "saved")
    return <Button onClick={form.newRecord}>{t("evaluations.form.newRecord")}</Button>;
  if (!form.command.needsReview) return null;
  return (
    <div role="alert">
      <InlineNotice tone="warning">{t("evaluations.form.failed")}</InlineNotice>
      <Button onClick={form.command.reset}>{t("evaluations.form.retry")}</Button>
    </div>
  );
}
