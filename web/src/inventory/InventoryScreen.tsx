import { useEffect, useMemo } from "react";
import { Outlet } from "@tanstack/react-router";
import { InventoryDraftMemory, inventoryDraftMemory } from "./use-inventory-draft";
import { InventoryScopeContext, useInventoryScope } from "./use-inventory-context";
import { InventoryContextNotice } from "./InventoryContextNotice";
const permissions = {
  supplies: { new: "supply_type.create", saved: "supply_type.update" },
  lots: { new: "lot.create", saved: "lot.update" },
  locations: { new: "location.create", saved: "location.update" },
};
/** Context transitions remount data observers while user/org memory survives reauthentication. */
export function InventoryScreen() {
  const scope = useInventoryScope();
  const memory = useMemo(() => ({ ...inventoryDraftMemory(), base: scope.base }), [scope.base]);
  useEffect(() => {
    if (!scope.identity.isSettled) return;
    const retained = Object.entries(memory.current).filter(([key]) => {
      const [kind, target] = key.split(":");
      if (!kind || !(kind in permissions)) return false;
      const action =
        permissions[kind as keyof typeof permissions][target === "new" ? "new" : "saved"];
      return (scope.identity.permissions ?? []).includes(action);
    });
    if (retained.length !== Object.keys(memory.current).length) {
      memory.current = Object.fromEntries(retained);
      memory.notify();
    }
  }, [memory, scope.identity.isSettled, scope.identity.permissions]);
  return (
    <InventoryScopeContext value={scope}>
      <InventoryDraftMemory value={memory}>
        {scope.readContext.mode === "invalid" ? (
          <InventoryContextNotice state="invalid" />
        ) : (
          <Outlet />
        )}
      </InventoryDraftMemory>
    </InventoryScopeContext>
  );
}
