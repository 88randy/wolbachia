import { InventoryContextNotice } from "../InventoryContextNotice";
import { useInventoryContext, useInventoryCode } from "../use-inventory-context";
import { ConditionsScreen } from "./ConditionsScreen";
export function W18Page() {
  const scope = useInventoryContext();
  const code = useInventoryCode() ?? "";
  const identity = scope.identity;
  const key = JSON.stringify([
    identity.userId,
    identity.organizationSlug,
    identity.authorization,
    identity.activeCenter,
    code,
    scope.readContext,
  ]);
  if (scope.readContext.mode === "invalid") return <InventoryContextNotice state="invalid" />;
  return <ConditionsScreen key={key} code={code} />;
}
