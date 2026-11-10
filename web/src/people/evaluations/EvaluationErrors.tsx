import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import type { EvaluationDraft } from "./evaluation-domain";
import { invalidFields } from "./evaluation-validation";
const KEYS = {
  subject: "evaluations.field.subject",
  center: "evaluations.field.center",
  quadrant: "evaluations.field.quadrant",
  observedAt: "evaluations.field.observed",
  presentation: "evaluations.field.presentation",
  execution: "evaluations.field.execution",
  coverage: "evaluations.field.coverage",
} as const;
export function EvaluationErrors({ draft }: { draft: EvaluationDraft }) {
  const { t } = useTranslation();
  return (
    <div role="alert" tabIndex={-1} id="evaluation-errors">
      <InlineNotice tone="warning">{t("evaluations.form.invalid")}</InlineNotice>
      <ul>
        {invalidFields(draft).map((key) => (
          <li key={key}>
            <a href={`#evaluation-${key}`}>{t(KEYS[key as keyof typeof KEYS])}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
