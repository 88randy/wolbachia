import type { Schemas } from "@wolbachia/api-client";
import type { Me } from "../../session/me";

export const SECTIONS = ["presentation", "execution", "coverage"] as const;
export type Section = (typeof SECTIONS)[number];
export interface EvaluationDraft extends Record<Section, string> {
  subject: string;
  center: string;
  quadrant: string;
  observedAt: string;
  critical: Record<string, string>;
}
export const EMPTY_DRAFT: EvaluationDraft = {
  subject: "",
  center: "",
  quadrant: "",
  observedAt: "",
  presentation: "",
  execution: "",
  coverage: "",
  critical: {},
};
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
export function isAwareInstant(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));
}
export function isDimensionAllowed(dimension: Me["scope"]["centers"], value: string): boolean {
  return (
    dimension.mode === "all" || (dimension.mode === "selected" && dimension.ids.includes(value))
  );
}
/** /me is a display projection; the backend independently checks each whole action grant. */
export function isContextAllowed(scope: Me["scope"], center: string, quadrant: string): boolean {
  return (
    isDimensionAllowed(scope.centers, center) &&
    (!quadrant || isDimensionAllowed(scope.quadrants, quadrant))
  );
}
function objectOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
/** Unknown JSON is narrowed once; absent configuration never becomes sample 20/50/30. */
export function readRubric(
  version: Pick<Schemas["RubricVersionRead"], "weights" | "critical_checks" | "pass_threshold">,
) {
  const weights = objectOf(version.weights);
  const checks = version.critical_checks;
  if (!weights || !Array.isArray(checks) || !checks.length) return null;
  if (!checks.every((check): check is string => typeof check === "string" && check.length > 0))
    return null;
  if (!SECTIONS.every((key) => typeof weights[key] === "number" && Number.isFinite(weights[key])))
    return null;
  return { weights, checks, threshold: version.pass_threshold };
}
/** Keep raw normalized sections and tri-state answers; the server alone scores the observation. */
export function evaluationBody(
  draft: EvaluationDraft,
  rubric: string,
  command: string,
): Schemas["EvaluationCreateRequest"] {
  return {
    command_id: command,
    expected_revision: 0,
    subject: draft.subject.trim(),
    center: draft.center.trim(),
    quadrant: draft.quadrant.trim() || null,
    observed_at: draft.observedAt.trim(),
    rubric_version: rubric,
    section_scores: Object.fromEntries(SECTIONS.map((key) => [key, draft[key].trim() || null])),
    critical_responses: Object.fromEntries(
      Object.entries(draft.critical).map(([key, value]) => [
        key,
        value === "" ? null : value === "true",
      ]),
    ),
  };
}
export function observationsOf(value: unknown): [string, string][] {
  const observations = objectOf(value);
  return observations
    ? Object.entries(observations).map(([key, answer]) => [key, scalarText(answer)])
    : [];
}
function scalarText(value: unknown): string {
  return typeof value === "string" || typeof value === "boolean" || typeof value === "number"
    ? String(value)
    : "";
}
