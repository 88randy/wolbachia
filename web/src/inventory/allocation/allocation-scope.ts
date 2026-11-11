import type { InventoryReadScope } from "../inventory-read-context";

/** An old router outlet cannot read or write while the address bar shows another screen. */
export function allocationRouteScope<Scope extends InventoryReadScope>(
  scope: Scope,
  route: string,
) {
  if (!scope.pathname) return scope;
  const path = scope.pathname.replace(/\/$/, "");
  const matches = path === route || path.startsWith(`${route}/`);
  return {
    ...scope,
    identity: { ...scope.identity, isSettled: scope.identity.isSettled && matches },
    isCurrentRead: () => matches && scope.isCurrentRead?.() !== false,
  };
}
