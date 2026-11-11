import type { Schemas } from "@wolbachia/api-client";

/**
 * Deliveries released to the courier that have no active receipt yet ("Tienes material por
 * recibir"). Read from the offline bundle, so it works without network.
 */
export function countPendingDeliveries(assignments: readonly Schemas["SupplyBundle"][]): number {
  return assignments.reduce(
    (total, assignment) =>
      total +
      assignment.releases.filter(
        (release) =>
          release.plan_revision === assignment.revision &&
          !assignment.receipts.some((row) => row.release_id === release.id && !row.voided),
      ).length,
    0,
  );
}
