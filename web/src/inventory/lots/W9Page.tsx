import { InventoryList } from "../InventoryList";
import { useInventoryContext } from "../use-inventory-context";
export function W9Page() {
  const { context } = useInventoryContext();
  return <InventoryList key={context} kind="lots" />;
}
