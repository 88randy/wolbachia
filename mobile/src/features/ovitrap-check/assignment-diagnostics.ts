/** Why the capture assignment ended up empty. Codes only: no names, codes or ids of people or points. */
export type AssignmentNullReason =
  "no_bundle_meta" | "no_org" | "cleanup_pending" | "publish_stale" | "point_removed";

let lastOutcome = "none";

/** Last outcome of building or publishing the assignment, for the on-screen diagnostic code. */
export function lastAssignmentOutcome(): string {
  return lastOutcome;
}
export function recordAssignmentOutcome(outcome: string): void {
  lastOutcome = outcome;
}
export function warnAssignmentNull(reason: AssignmentNullReason): void {
  recordAssignmentOutcome(reason);
  console.warn(`[capture-assignment] null reason=${reason}`);
}
