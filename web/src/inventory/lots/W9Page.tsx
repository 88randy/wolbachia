import { InventoryScreen } from "../InventoryScreen";
import { InventoryList } from "../InventoryList";
import { useInventoryContext } from "../use-inventory-context";
export function W9Page() {
  const { context } = useInventoryContext();
  return (
    <InventoryScreen>
      <InventoryList key={context} kind="lots" />
    </InventoryScreen>
  );
}
