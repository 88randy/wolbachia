import type { InventoryKind, InventoryRecord } from "./inventory-links";
import { InventoryCreateDialog } from "./InventoryCreateDialog";
import { useInventoryContext } from "./use-inventory-context";
import { useInventoryLabels } from "./use-inventory-labels";

/** Header actions of an inventory list: print the labels of the page, and create when allowed. */
export function InventoryPageActions({
  kind,
  rows,
}: {
  kind: InventoryKind;
  rows: readonly InventoryRecord[];
}) {
  const scope = useInventoryContext();
  const labels = useInventoryLabels();
  return (
    <>
      {kind !== "supplies" && labels.pageAction(rows)}
      {scope.readContext.mode === "admission" && <InventoryCreateDialog kind={kind} />}
    </>
  );
}
