import type { EvaluationDraft } from "./evaluation-domain";
import { isUuid, isAwareInstant, SECTIONS } from "./evaluation-domain";
export const CONTEXT_FIELDS = ["subject", "center", "quadrant", "observedAt"] as const;
export function isValidScore(value: string): boolean {
  return value === "" || (/^\d+(\.\d{1,4})?$/.test(value) && Number(value) <= 100);
}
export function invalidFields(draft: EvaluationDraft): string[] {
  const invalid: string[] = [];
  if (!isUuid(draft.subject.trim())) invalid.push("subject");
  if (!isUuid(draft.center.trim())) invalid.push("center");
  if (draft.quadrant.trim() && !isUuid(draft.quadrant.trim())) invalid.push("quadrant");
  if (!isAwareInstant(draft.observedAt.trim())) invalid.push("observedAt");
  return [...invalid, ...SECTIONS.filter((key) => !isValidScore(draft[key]))];
}
