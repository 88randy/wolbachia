import type { Schemas } from "@wolbachia/api-client";
import type { LinkProps } from "@tanstack/react-router";
export type InventoryKind = "supplies" | "lots" | "locations";
export type InventoryRecord = Schemas["Supply"] | Schemas["Lot"] | Schemas["Location"];
type PlacementTarget =
  { kind: "lotUpdate"; lot: string } | { kind: "lotCreate" | "locationCreate"; center: string };
/** Closed modes never send an override of a saved lot's actual destination. */
export function placementQueryFor(target: PlacementTarget) {
  if (target.kind === "lotUpdate") return { lot: target.lot };
  return {
    action: target.kind === "lotCreate" ? ("lot.create" as const) : ("location.create" as const),
    center: target.center,
  };
}
export function movementFiltersOf(stock: Pick<Schemas["Stock"], "lot" | "piece_id" | "unit">) {
  return { lot: stock.lot, piece: stock.piece_id ?? "none", unit: stock.unit };
}
export function inventoryRecordPath(kind: InventoryKind, code: string) {
  return `/inventory/${kind}/${encodeURIComponent(code)}`;
}
export function inventoryRecordLink(kind: InventoryKind, code: string): LinkProps {
  const to =
    kind === "supplies"
      ? "/inventory/supplies/$code"
      : kind === "lots"
        ? "/inventory/lots/$code"
        : "/inventory/locations/$code";
  return { to, params: { code } };
}
