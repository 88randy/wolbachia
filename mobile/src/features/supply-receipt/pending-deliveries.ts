import type { Schemas } from "@wolbachia/api-client";

type Assignment = Schemas["SupplyBundle"];
export interface PendingDelivery {
  readonly assignment: Assignment;
  readonly release: Assignment["releases"][number];
}

/**
 * Deliveries the courier can receive now: released for the current plan revision, with no active
 * receipt yet (on the server or started on this phone), and belonging to the open shift (or to no shift). The list on the receive screen and
 * the "Tienes material por recibir" count both come from here, newest first, so they never differ.
 * With no known open shift the shift is not used to filter.
 */
export function pendingDeliveries(
  assignments: readonly Assignment[],
  shiftId: string | null,
  startedReleaseIds: readonly string[] = [],
): readonly PendingDelivery[] {
  return assignments
    .filter(
      (assignment) =>
        shiftId === null || assignment.shift_id === null || assignment.shift_id === shiftId,
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.revision - a.revision)
    .flatMap((assignment) =>
      assignment.releases
        .filter(
          (release) =>
            release.plan_revision === assignment.revision &&
            !startedReleaseIds.includes(release.id) &&
            !assignment.receipts.some((row) => row.release_id === release.id && !row.voided),
        )
        .map((release) => ({ assignment, release })),
    );
}

export function countPendingDeliveries(
  assignments: readonly Assignment[],
  shiftId: string | null = null,
  startedReleaseIds: readonly string[] = [],
): number {
  return pendingDeliveries(assignments, shiftId, startedReleaseIds).length;
}
