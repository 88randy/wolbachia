import { useTranslation } from "react-i18next";
import { EvaluationFields } from "./EvaluationFields";
import { EvaluationRubricSelection } from "./EvaluationRubricSelection";
import type { EvaluationFormModel } from "./use-evaluation-form";
import styles from "./evaluations.module.css";
export function EvaluationObservationFields({ form }: { form: EvaluationFormModel }) {
  const { t } = useTranslation();
  return (
    <fieldset
      className={styles.entry}
      disabled={form.command.status !== null}
      aria-label={t("evaluations.form.title")}
    >
      <EvaluationFields {...form} />
      <EvaluationRubricSelection form={form} />
    </fieldset>
  );
}
