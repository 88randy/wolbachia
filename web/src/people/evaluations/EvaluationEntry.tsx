import { useTranslation } from "react-i18next";
import { EvaluationObservationFields } from "./EvaluationObservationFields";
import { EvaluationErrors } from "./EvaluationErrors";
import { EvaluationSubmit } from "./EvaluationSubmit";
import { EvaluationReceipt } from "./EvaluationReceipt";
import { invalidFields } from "./evaluation-validation";
import type { EvaluationFormModel } from "./use-evaluation-form";
import styles from "./evaluations.module.css";
export function EvaluationEntry({ form }: { form: EvaluationFormModel }) {
  const { t } = useTranslation();
  const hasErrors = form.isSubmitted && invalidFields(form.draft).length > 0;
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <p>{t("evaluations.page.identifiers")}</p>
      {hasErrors && <EvaluationErrors draft={form.draft} />}
      <EvaluationObservationFields form={form} />
      <EvaluationSubmit form={form} />
      <EvaluationReceipt form={form} />
    </form>
  );
}
