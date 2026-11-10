import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { RubricFacts } from "./RubricFacts";
import { EvaluationScores } from "./EvaluationScores";
import type { EvaluationFormModel } from "./use-evaluation-form";
export function EvaluationRubricSelection({ form }: { form: EvaluationFormModel }) {
  const { t } = useTranslation();
  if (!form.version)
    return <InlineNotice tone="info">{t("evaluations.rubric.unconfigured")}</InlineNotice>;
  return (
    <>
      <RubricFacts version={form.version} />
      <p>{t("evaluations.form.scores")}</p>
      <EvaluationScores {...form} version={form.version} />
    </>
  );
}
