import { EvaluationObservedField } from "./EvaluationObservedField";
import { EvaluationPicker } from "./EvaluationPicker";
import type { EvaluationDraft } from "./evaluation-domain";
import { invalidFields } from "./evaluation-validation";
import styles from "./evaluations.module.css";

interface Props {
  draft: EvaluationDraft;
  change: (name: keyof EvaluationDraft, value: string) => void;
  isSubmitted: boolean;
}

const PICKERS = [
  { name: "subject", labelKey: "evaluations.field.subject", isOptional: false },
  { name: "center", labelKey: "evaluations.field.center", isOptional: false },
  { name: "quadrant", labelKey: "evaluations.field.quadrant", isOptional: true },
] as const;

/** Person, center and quadrant are picked by name and the observation time with a calendar. */
export function EvaluationFields({ draft, change, isSubmitted }: Props) {
  const invalid = invalidFields(draft);
  return (
    <div className={styles.fields}>
      {PICKERS.map((picker) => (
        <EvaluationPicker
          key={picker.name}
          {...picker}
          value={draft[picker.name]}
          isInvalid={invalid.includes(picker.name)}
          isSubmitted={isSubmitted}
          onChange={(value) => {
            change(picker.name, value);
          }}
        />
      ))}
      <div className={styles.wide}>
        <EvaluationObservedField
          value={draft.observedAt}
          hasError={isSubmitted && invalid.includes("observedAt")}
          onChange={(value) => {
            change("observedAt", value);
          }}
        />
      </div>
    </div>
  );
}
