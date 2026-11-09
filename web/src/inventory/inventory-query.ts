import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { centerIdentity } from "../centers/center-filter";
import { inventoryParams } from "./inventory-table";
import type { InventoryKind } from "./inventory-links";
import { inventoryRecordPath } from "./inventory-links";
import { assertInventoryRead, inventoryScopedOptions } from "./inventory-read-context";
import type { InventoryReadScope } from "./inventory-read-context";
export interface InventoryScope extends InventoryReadScope {
  client: ApiClient;
  identity: SessionIdentity;
}
const ROOT = "inventory";
type Params = Record<string, string | number>;
export function inventoryRouteScope<Scope extends InventoryScope>(
  scope: Scope,
  kind: InventoryKind,
  code?: string,
): Scope {
  if (!scope.pathname) return scope;
  const target = code === undefined ? `/inventory/${kind}` : inventoryRecordPath(kind, code);
  let matches = false;
  try {
    matches = decodeURIComponent(scope.pathname.replace(/\/$/, "")) === decodeURIComponent(target);
  } catch {
    matches = false;
  }
  return {
    ...scope,
    identity: { ...scope.identity, isSettled: scope.identity.isSettled && matches },
    isCurrentRead: () => matches && scope.isCurrentRead?.() !== false,
  };
}
async function referenceId(
  scope: InventoryScope,
  target: { relation: string; code: string },
  signal: AbortSignal,
) {
  const { relation, code } = target;
  assertInventoryRead(scope, signal);
  if (/^[0-9a-f-]{36}$/i.test(code)) return code;
  const params = { query: { code, page: 1 } };
  if (relation === "center")
    return unwrap(await scope.client.GET("/api/v1/centers/", { params, signal })).results.find(
      (row) => row.code === code,
    )?.id;
  const kind = relation === "supply" ? "supplies" : relation === "lot" ? "lots" : "locations";
  return (await readInventory(scope, { kind, query: { code, page: 1 } }, signal)).results.find(
    (row) => row.code === code,
  )?.id;
}
async function resolvedParams(scope: InventoryScope, params: Params, signal: AbortSignal) {
  const resolved = { ...params };
  for (const relation of ["center", "supply", "location", "lot"]) {
    const value = params[relation];
    if (typeof value !== "string") continue;
    const identifier = await referenceId(scope, { relation, code: value }, signal);
    if (!identifier) return null;
    resolved[relation] = identifier;
  }
  return resolved;
}
/** API operations remain generated; no alternative transport or client-side list filtering. */
async function readInventory(
  scope: InventoryScope,
  target: { kind: InventoryKind; query: Params },
  signal: AbortSignal,
) {
  const { kind, query } = target;
  assertInventoryRead(scope, signal);
  const options = { params: { query }, signal };
  if (kind === "supplies") return unwrap(await scope.client.GET("/api/v1/supply-types/", options));
  if (kind === "lots") {
    const lotQuery: Params = { ...query };
    const read = scope.readContext;
    if (read?.mode === "custody") lotQuery["custody_location"] = read.location;
    const page = unwrap(
      await scope.client.GET("/api/v1/lots/", { params: { query: lotQuery }, signal }),
    );
    if (
      read?.mode === "custody" &&
      page.results.some((row) => row.safety_location_id !== read.location)
    )
      throw new Error("Unproved inventory custody context");
    return page;
  }
  return unwrap(await scope.client.GET("/api/v1/locations/", options));
}
export function inventoryListOptions(
  scope: InventoryScope,
  kind: InventoryKind,
  state: TableState,
) {
  const source = inventoryRouteScope(scope, kind);
  const center =
    state.filters["center"] ??
    (kind === "lots" && scope.readContext?.mode === "custody"
      ? undefined
      : scope.identity.activeCenter);
  const identity = kind === "supplies" ? source.identity : centerIdentity(source.identity, center);
  return inventoryScopedOptions(
    { ...source, identity },
    {
      key: [ROOT, kind, state, center],
      queryFn: async ({ signal }) => {
        const params = {
          ...inventoryParams(state),
          ...(kind !== "supplies" && center ? { center } : {}),
        };
        const query = await resolvedParams(scope, params, signal);
        return query
          ? readInventory(scope, { kind, query }, signal)
          : { count: 0, next: null, previous: null, results: [] };
      },
    },
  );
}
export function inventoryRecordOptions(scope: InventoryScope, kind: InventoryKind, code: string) {
  const source = inventoryRouteScope(scope, kind, code);
  return inventoryScopedOptions(source, {
    key: [ROOT, kind, "record", code, scope.identity.activeCenter],
    queryFn: ({ signal }) => readRecord(source, { kind, code }, signal),
  });
}
/** Explicit reconciliation reads its immutable command target, not the create screen URL. */
export function inventoryReconciliationOptions(
  scope: InventoryScope,
  kind: InventoryKind,
  code: string,
) {
  const source = {
    ...scope,
    isCurrentRead: () => scope.readContext?.mode !== "custody" && scope.isCurrentRead?.() !== false,
  };
  return inventoryScopedOptions(source, {
    key: [ROOT, kind, "reconcile", code],
    queryFn: ({ signal }) => readRecord(source, { kind, code }, signal),
  });
}
function recordParams(
  scope: InventoryScope,
  target: { kind: InventoryKind; code: string },
): Params {
  const center =
    target.kind !== "supplies" && scope.readContext?.mode !== "custody"
      ? scope.identity.activeCenter
      : undefined;
  return { code: target.code, page: 1, ...(center ? { center } : {}) };
}
async function readRecord(
  scope: InventoryScope,
  target: { kind: InventoryKind; code: string },
  signal: AbortSignal,
) {
  const resolved = await resolvedParams(scope, recordParams(scope, target), signal);
  if (!resolved) return null;
  try {
    const page = await readInventory(scope, { kind: target.kind, query: resolved }, signal);
    const record = page.results.find((row) => row.code === target.code) ?? null;
    if (target.kind !== "lots" || !record || scope.readContext?.mode !== "custody") return record;
    assertInventoryRead(scope, signal);
    return unwrap(
      await scope.client.GET("/api/v1/lots/{id}/", {
        params: {
          path: { id: record.id },
          query: { custody_location: scope.readContext.location },
        },
        signal,
      }),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
export function inventoryStockOptions(
  scope: InventoryScope,
  target: { location: string; movements: boolean },
  state: TableState,
) {
  const { location, movements } = target;
  return inventoryScopedOptions(scope, {
    key: [ROOT, location, movements, state],
    queryFn: async ({ signal }) => {
      const params: Params = inventoryParams(state);
      const { lot, ...rest } = params;
      const referenceScope: InventoryScope = {
        ...scope,
        readContext: { mode: "custody", location },
      };
      const query = await resolvedParams(referenceScope, movements ? rest : params, signal);
      if (!query) return { count: 0, next: null, previous: null, results: [] };
      if (movements && lot !== undefined) query["lot"] = lot;
      assertInventoryRead(scope, signal);
      const options = { params: { path: { id: location }, query }, signal };
      return movements
        ? unwrap(await scope.client.GET("/api/v1/locations/{id}/movements/", options))
        : unwrap(await scope.client.GET("/api/v1/locations/{id}/stock/", options));
    },
  });
}
export function invalidateInventory(client: QueryClient) {
  return invalidateOrgScoped(client, ROOT);
}
export function currentSupplyOptions(scope: InventoryScope, supply: string, allowed: boolean) {
  return inventoryScopedOptions(
    {
      ...scope,
      identity: {
        ...scope.identity,
        isSettled: scope.identity.isSettled && allowed && scope.readContext?.mode !== "custody",
      },
    },
    {
      key: [ROOT, "current-supply", supply],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/supply-types/{id}/", {
            params: { path: { id: supply } },
            signal,
          }),
        ),
    },
  );
}
