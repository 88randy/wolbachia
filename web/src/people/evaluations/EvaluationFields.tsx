import { useTranslation } from "react-i18next";
import { EvaluationInput } from "./EvaluationInput";
import type { EvaluationDraft } from "./evaluation-domain";
import { CONTEXT_FIELDS, invalidFields } from "./evaluation-validation";
import styles from "./evaluations.module.css";
interface Props {
  draft: EvaluationDraft;
  change: (name: keyof EvaluationDraft, value: string) => void;
  isSubmitted: boolean;
}
const KEYS = {
  subject: "evaluations.field.subject",
  center: "evaluations.field.center",
  quadrant: "evaluations.field.quadrant",
  observedAt: "evaluations.field.observed",
} as const;
export function EvaluationFields({ draft, change, isSubmitted }: Props) {
  const { t } = useTranslation();
  const invalid = invalidFields(draft);
  return (
    <div className={styles.fields}>
      {CONTEXT_FIELDS.map((name) => (
        <EvaluationInput
          key={name}
          name={name}
          labelKey={KEYS[name]}
          value={draft[name]}
          onChange={(value) => {
            change(name, value);
          }}
          isInvalid={invalid.includes(name)}
          isSubmitted={isSubmitted}
          {...(name === "observedAt" ? { hint: t("evaluations.field.instantHint") } : {})}
        />
      ))}
    </div>
  );
}
