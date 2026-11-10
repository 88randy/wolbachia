import { EvaluationInput } from "./EvaluationInput";
import type { Section } from "./evaluation-domain";
import { SECTION_KEYS } from "./evaluation-labels";
import { isValidScore } from "./evaluation-validation";
import type { EvaluationFormModel } from "./use-evaluation-form";
interface Props {
  name: Section;
  form: Pick<EvaluationFormModel, "draft" | "change" | "isSubmitted">;
}
export function EvaluationSectionScore({ name, form }: Props) {
  return (
    <EvaluationInput
      numeric
      name={name}
      labelKey={SECTION_KEYS[name]}
      value={form.draft[name]}
      onChange={(value) => {
        form.change(name, value);
      }}
      isInvalid={!isValidScore(form.draft[name])}
      isSubmitted={form.isSubmitted}
    />
  );
}
