import { InventoryContextNotice } from "../InventoryContextNotice";
import { InventoryRecord } from "../InventoryRecord";
import { useInventoryContext, useInventoryCode } from "../use-inventory-context";
import { LotCreatePage } from "./LotCreatePage";
export function W10Page() {
  const code = useInventoryCode();
  const { context, readContext } = useInventoryContext();
  if (!code && readContext.mode !== "admission") return <InventoryContextNotice state="readonly" />;
  return (
    <>
      {code ? (
        <InventoryRecord key={`${context}:${code}`} kind="lots" />
      ) : (
        <LotCreatePage key={context} />
      )}
    </>
  );
}
