import type { Certification, Eligibility } from "./types.ts";

export type QualificationState = "eligible" | "blocked" | "expired" | "unavailable";
export interface QualificationAction {
  readonly action: string;
  readonly centerId: string;
  readonly quadrantId: string | null;
  readonly now: Date;
}
/** Only narrow the backend's current semantic receipt. Never infer qualification from a score. */
function temporalQualification(row: Eligibility, instant: number): QualificationState | null {
  if (!Number.isFinite(instant)) return "unavailable";
  if (row.valid_until !== null && instant >= Date.parse(row.valid_until)) return "expired";
  if (row.valid_from !== null && instant < Date.parse(row.valid_from)) return "unavailable";
  if (row.next_change_at !== null && instant >= Date.parse(row.next_change_at))
    return "unavailable";
  return null;
}
export function qualificationState(row: Eligibility, now: Date): QualificationState {
  const temporal = temporalQualification(row, now.getTime());
  if (temporal !== null) return temporal;
  if (!row.training_eligible || row.blockers.length) return "blocked";
  if (!row.assessment_receipt || !row.requirement_version_id) return "unavailable";
  return "eligible";
}
export function certificationState(row: Certification, now: Date) {
  const instant = now.getTime();
  if (!Number.isFinite(instant)) return "unavailable";
  if (row.revoked_from !== null && instant >= Date.parse(row.revoked_from)) return "revoked";
  if (instant >= Date.parse(row.valid_to)) return "expired";
  return instant < Date.parse(row.valid_from) ? "future" : "valid";
}
/** Exact configured action/context only: a nearby course, another quadrant or missing policy never grants. */
export function qualificationForAction(
  rows: readonly Eligibility[],
  input: QualificationAction,
): QualificationState {
  const matches = rows.filter(
    (row) =>
      row.action === input.action &&
      row.center_id === input.centerId &&
      row.quadrant_id === input.quadrantId,
  );
  return matches.length === 1 && matches[0]
    ? qualificationState(matches[0], input.now)
    : "unavailable";
}
