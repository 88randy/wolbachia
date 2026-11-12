import { locationLabel, lotLabel } from "../labels/label-records";
import type { LabelText } from "../labels/label-records";
import type { LabelRecord } from "../labels/label-record";
import { useRowLabels } from "../labels/use-row-labels";
import type { InventoryRecord } from "./inventory-links";

/** Lots and locations have a human code to print; supplies do not. */
function inventoryLabel(row: InventoryRecord, text: LabelText): LabelRecord | null {
  if ("supply_version" in row) return lotLabel(row, text);
  if ("geometry" in row) return locationLabel(row, text);
  return null;
}

/** Label printing of inventory lists and records. */
export function useInventoryLabels() {
  return useRowLabels<InventoryRecord>({
    toRecord: inventoryLabel,
    rowLabel: (row) => row.code,
  });
}
