/** Why the capture assignment ended up empty. Codes only: no names, codes or ids of people or points. */
export type AssignmentNullReason =
  "no_bundle_meta" | "no_org" | "cleanup_pending" | "publish_stale" | "point_removed";

/** Logged for adb only; never shown to the courier. */
export function warnAssignmentNull(reason: AssignmentNullReason): void {
  console.warn(`[capture-assignment] null reason=${reason}`);
}
