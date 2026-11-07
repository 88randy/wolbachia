import { InventoryRecord } from "./InventoryRecord";
import { InventoryList } from "./InventoryList";
import { useInventoryContext, useInventoryCode } from "./use-inventory-context";
import type { InventoryKind } from "./inventory-links";
export function InventoryResourcePage({ kind }: { kind: InventoryKind }) {
  const code = useInventoryCode();
  const { context } = useInventoryContext();
  return (
    <>
      {code ? (
        <InventoryRecord key={`${context}:${code}`} kind={kind} />
      ) : (
        <InventoryList key={context} kind={kind} />
      )}
    </>
  );
}
