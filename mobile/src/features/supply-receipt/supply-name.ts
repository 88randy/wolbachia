import type { Schemas } from "@wolbachia/api-client";
import type { ReceiptDraft } from "./receipt-types.ts";

/** The supply name the server sent with the delivery; null for a delivery downloaded before names existed. */
export function supplyName(
  assignments: readonly Schemas["SupplyBundle"][],
  assignmentId: string,
  line: ReceiptDraft["lines"][number],
): string | null {
  const found = assignments
    .find((assignment) => assignment.id === assignmentId)
    ?.lines.find((row) => row.lot_id === line.lotId && row.unit_version_id === line.unitVersionId);
  return found?.name?.trim() || null;
}
