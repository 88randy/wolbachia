import { CancelledError } from "@tanstack/react-query";
import type { QueryFunction } from "@tanstack/react-query";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";

export type InventoryReadContext =
  { mode: "admission" } | { mode: "custody"; location: string } | { mode: "invalid" };
export interface InventoryReadScope {
  identity: SessionIdentity;
  readContext?: InventoryReadContext;
  context?: string;
  pathname?: string;
  isCurrentRead?: () => boolean;
}
export function inventoryReadContext(search: Record<string, unknown>): InventoryReadContext {
  if (!("custody_location" in search)) return { mode: "admission" };
  const value = search["custody_location"];
  return typeof value === "string" && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value)
    ? { mode: "custody", location: value.toLowerCase() }
    : { mode: "invalid" };
}
export function assertInventoryRead(scope: InventoryReadScope, signal: AbortSignal) {
  if (signal.aborted || scope.readContext?.mode === "invalid" || scope.isCurrentRead?.() === false)
    throw new CancelledError({ revert: true });
}
export function assertInventoryAction(scope: InventoryReadScope, signal: AbortSignal) {
  assertInventoryRead(scope, signal);
  if (scope.readContext?.mode === "custody") throw new CancelledError({ revert: true });
}
/** The inventory view fence also controls placeholders; a query key alone cannot do that. */
export function inventoryScopedOptions<T>(
  scope: InventoryReadScope,
  request: { key: readonly unknown[]; queryFn: QueryFunction<T> },
) {
  const fence = scope.context ?? JSON.stringify([scope.identity, scope.readContext]);
  const options = orgScopedQueryOptions(scope.identity, {
    key: [...request.key, fence],
    queryFn: async (context) => {
      assertInventoryRead(scope, context.signal);
      try {
        return await request.queryFn(context);
      } finally {
        assertInventoryRead(scope, context.signal);
      }
    },
  });
  return {
    ...options,
    enabled: scope.identity.isSettled && scope.readContext?.mode !== "invalid",
    meta: { ...options.meta, inventoryView: fence },
    placeholderData: (
      previous: T | undefined,
      query: { meta?: Record<string, unknown> } | undefined,
    ) => (query?.meta?.["inventoryView"] === fence ? previous : undefined),
  };
}
