import { ApiError, unwrap } from "@wolbachia/api-client";
import type { InventoryScope } from "../inventory-query";
import { inventoryScopedOptions, assertInventoryRead } from "../inventory-read-context";
import type { TableState } from "../../data-table/table-types";

export function conditionRouteScope<Scope extends InventoryScope>(
  scope: Scope,
  code: string,
): Scope {
  const target = `/inventory/lots/${encodeURIComponent(code)}/conditions`;
  const matches = scope.pathname === target;
  return {
    ...scope,
    identity: { ...scope.identity, isSettled: scope.identity.isSettled && matches },
    isCurrentRead: () => matches && scope.isCurrentRead?.() !== false,
  };
}

export function conditionLotOptions(scope: InventoryScope, code: string) {
  return inventoryScopedOptions(scope, {
    key: ["inventory", "condition-lot", code],
    queryFn: ({ signal }) => readConditionLot(scope, code, signal),
  });
}
async function readConditionLot(scope: InventoryScope, code: string, signal: AbortSignal) {
  const custody = scope.readContext?.mode === "custody" ? scope.readContext.location : undefined;
  const query = {
    code,
    ...(custody ? { custody_location: custody } : { center: scope.identity.activeCenter }),
  };
  try {
    const page = unwrap(await scope.client.GET("/api/v1/lots/", { params: { query }, signal }));
    assertInventoryRead(scope, signal);
    return (
      page.results.find(
        (row) => row.code === code && (!custody || row.safety_location_id === custody),
      ) ?? null
    );
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) return null;
    throw error;
  }
}
export function conditionStatusOptions(scope: InventoryScope, lot: string | undefined) {
  return inventoryScopedOptions(
    { ...scope, identity: { ...scope.identity, isSettled: scope.identity.isSettled && !!lot } },
    {
      key: ["inventory", "condition-status", lot],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/lots/{id}/condition-status/", {
            params: {
              path: { id: lot ?? "" },
              query:
                scope.readContext?.mode === "custody"
                  ? { location_id: scope.readContext.location }
                  : {},
            },
            signal,
          }),
        ),
    },
  );
}
export function conditionReadingsOptions(scope: InventoryScope, lot: string, state: TableState) {
  return inventoryScopedOptions(scope, {
    key: ["inventory", "condition-readings", lot, state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/lots/{id}/conditions/", {
          params: {
            path: { id: lot },
            query: {
              page: state.page,
              page_size: 25,
              ordering: state.sort
                ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
                : undefined,
              ...state.filters,
              ...(scope.readContext?.mode === "custody"
                ? { location_id: scope.readContext.location }
                : {}),
            },
          },
          signal,
        }),
      ),
  });
}
