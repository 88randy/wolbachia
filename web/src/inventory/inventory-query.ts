import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import { orgScopedQueryOptions, invalidateOrgScoped } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { centerIdentity } from "../centers/center-filter";
import { inventoryParams } from "./inventory-table";
import type { InventoryKind } from "./inventory-links";
export interface InventoryScope {
  client: ApiClient;
  identity: SessionIdentity;
}
const ROOT = "inventory";
type Params = Record<string, string | number>;
async function referenceId(
  scope: InventoryScope,
  target: { relation: string; code: string },
  signal: AbortSignal,
) {
  const { relation, code } = target;
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
  const options = { params: { query }, signal };
  if (kind === "supplies") return unwrap(await scope.client.GET("/api/v1/supply-types/", options));
  if (kind === "lots") return unwrap(await scope.client.GET("/api/v1/lots/", options));
  return unwrap(await scope.client.GET("/api/v1/locations/", options));
}
export function inventoryListOptions(
  scope: InventoryScope,
  kind: InventoryKind,
  state: TableState,
) {
  const center = state.filters["center"] ?? scope.identity.activeCenter;
  const identity = kind === "supplies" ? scope.identity : centerIdentity(scope.identity, center);
  return orgScopedQueryOptions(identity, {
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
  });
}
export function inventoryRecordOptions(scope: InventoryScope, kind: InventoryKind, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [ROOT, kind, "record", code, scope.identity.activeCenter],
    queryFn: async ({ signal }) => {
      const query = {
        code,
        page: 1,
        ...(kind !== "supplies" && scope.identity.activeCenter
          ? { center: scope.identity.activeCenter }
          : {}),
      };
      const resolved = await resolvedParams(scope, query, signal);
      if (!resolved) return null;
      try {
        const page = await readInventory(scope, { kind, query: resolved }, signal);
        return page.results.find((record) => record.code === code) ?? null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}
export function inventoryStockOptions(
  scope: InventoryScope,
  target: { location: string; movements: boolean },
  state: TableState,
) {
  const { location, movements } = target;
  return orgScopedQueryOptions(scope.identity, {
    key: [ROOT, location, movements, state],
    queryFn: async ({ signal }) => {
      const query = await resolvedParams(scope, inventoryParams(state), signal);
      if (!query) return { count: 0, next: null, previous: null, results: [] };
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
  return orgScopedQueryOptions(
    { ...scope.identity, isSettled: scope.identity.isSettled && allowed },
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
