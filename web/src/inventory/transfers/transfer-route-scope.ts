import type { InventoryReadScope } from "../inventory-read-context";
type Resource = "transfers" | "discrepancies";
function ownsRoute(pathname: string, target: string) {
  try {
    return decodeURIComponent(pathname.replace(/\/$/, "")) === decodeURIComponent(target);
  } catch {
    return false;
  }
}
/** Old router outlets cannot read or write a different record during a navigation transition. */
export function transferRouteScope<Scope extends InventoryReadScope>(
  scope: Scope,
  resource: Resource,
  code?: string,
) {
  if (!scope.pathname) return scope;
  const target = `/inventory/${resource}${code === undefined ? "" : `/${encodeURIComponent(code)}`}`;
  const matches = ownsRoute(scope.pathname, target);
  return {
    ...scope,
    identity: { ...scope.identity, isSettled: scope.identity.isSettled && matches },
    isCurrentRead: () => matches && scope.isCurrentRead?.() !== false,
  };
}
