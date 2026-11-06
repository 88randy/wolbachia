import { useParams } from "@tanstack/react-router";
import { InventoryScreen } from "../InventoryScreen";
import { InventoryRecord } from "../InventoryRecord";
import { useInventoryContext } from "../use-inventory-context";
import { LotCreatePage } from "./LotCreatePage";
export function W10Page() {
  const { code } = useParams({ strict: false });
  const { context } = useInventoryContext();
  return (
    <InventoryScreen>
      {code ? (
        <InventoryRecord key={`${context}:${code}`} kind="lots" />
      ) : (
        <LotCreatePage key={context} />
      )}
    </InventoryScreen>
  );
}
