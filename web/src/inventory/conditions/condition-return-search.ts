import type { InventoryReadContext } from "../inventory-read-context";
/** Preserve selected navigation context without carrying condition-only filters into lot detail. */
export function conditionReturnSearch(
  context: InventoryReadContext,
  search: Record<string, unknown>,
): Record<string, string> {
  return {
    ...(context.mode === "custody" ? { custody_location: context.location } : {}),
    ...(typeof search["center"] === "string" ? { center: search["center"] } : {}),
  };
}
