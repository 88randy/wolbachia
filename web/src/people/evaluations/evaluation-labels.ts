import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
export const OUTCOME_KEYS: Record<Schemas["EvaluationOutcomeEnum"], MessageKey> = {
  pass: "evaluations.result.pass",
  low: "evaluations.result.low",
  incomplete: "evaluations.result.incomplete",
  critical_failure: "evaluations.result.criticalFailure",
};
export const SECTION_KEYS = {
  presentation: "evaluations.field.presentation",
  execution: "evaluations.field.execution",
  coverage: "evaluations.field.coverage",
} as const;
