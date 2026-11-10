import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { InlineNotice } from "../../ui/InlineNotice";
import { EvaluationReviewButton } from "./EvaluationReviewButton";
import { EvaluationSubmissionFeedback } from "./EvaluationSubmissionFeedback";
import type { EvaluationFormModel } from "./use-evaluation-form";
export function EvaluationSubmit({ form }: { form: EvaluationFormModel }) {
  const { t } = useTranslation();
  return (
    <>
      {form.isBlocked && (
        <InlineNotice tone="warning">{t("evaluations.form.blocked")}</InlineNotice>
      )}
      {!form.isOnline && (
        <InlineNotice tone="warning">{t("evaluations.form.offline")}</InlineNotice>
      )}
      <ConfirmDialog
        title={t("evaluations.form.save")}
        consequence={t("evaluations.form.confirm")}
        actionLabel={t("evaluations.form.save")}
        onConfirm={form.send}
        trigger={<EvaluationReviewButton form={form} />}
      />
      <EvaluationSubmissionFeedback form={form} />
    </>
  );
}
