import { unwrap } from "@wolbachia/api-client";
import type { Schemas, operations } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "../inventory-read-context";
import type { useInventoryContext } from "../use-inventory-context";
import type { TableState } from "../../data-table/table-types";
import { allocationRouteScope } from "./allocation-scope";

export type AllocationScope = ReturnType<typeof useInventoryContext>;
export type Reconciliation = Schemas["SupplyReconciliation"];
export type WriteOff = Schemas["WriteOffRead"];
export type Suggestion = Schemas["SupplySuggestion"];
export const ALLOCATION_PAGE_SIZE = 25;
export const ASSIGNMENTS_ROUTE = "/inventory/assignments";
export const RECONCILIATIONS_ROUTE = "/inventory/reconciliations";
export const WRITE_OFFS_ROUTE = "/inventory/write-offs";
export const LAB_WRITE_OFFS_ROUTE = "/lab/write-offs";
type ReconciliationQuery = NonNullable<operations["reconciliations_list"]["parameters"]["query"]>;
type WriteOffQuery = NonNullable<operations["write_offs_list"]["parameters"]["query"]>;

function listParams(state: TableState) {
  return {
    ...state.filters,
    ...(state.isSortExplicit && state.sort
      ? { ordering: `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}` }
      : {}),
    page: state.page,
    page_size: ALLOCATION_PAGE_SIZE,
  };
}

export function reconciliationListOptions(scope: AllocationScope, state: TableState) {
  const query = listParams(state) as ReconciliationQuery;
  return inventoryScopedOptions(allocationRouteScope(scope, RECONCILIATIONS_ROUTE), {
    key: ["allocation", "reconciliations", query],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/reconciliations/", { params: { query }, signal })),
  });
}

export function writeOffListOptions(scope: AllocationScope, state: TableState, route: string) {
  const query = listParams(state) as WriteOffQuery;
  return inventoryScopedOptions(allocationRouteScope(scope, route), {
    key: ["allocation", "write-offs", query],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/write-offs/", { params: { query }, signal })),
  });
}

/** A missing schedule yields `unavailable`, never invented quantities. */
export function suggestionOptions(scope: AllocationScope, date: string, courier: string) {
  return inventoryScopedOptions(allocationRouteScope(scope, ASSIGNMENTS_ROUTE), {
    key: ["allocation", "suggestion", date, courier],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/courier-assignments/suggestion/", {
          params: { query: { date, courier } },
          signal,
        }),
      ),
  });
}

export function assignmentOptions(scope: AllocationScope, date: string, courier: string) {
  return inventoryScopedOptions(allocationRouteScope(scope, ASSIGNMENTS_ROUTE), {
    key: ["allocation", "assignment", date, courier],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/courier-assignments/", {
          params: { query: { date, courier, page_size: 1 } },
          signal,
        }),
      ).results[0] ?? null,
  });
}

export function originOptions(scope: AllocationScope, route: string) {
  return inventoryScopedOptions(allocationRouteScope(scope, route), {
    key: ["allocation", "origins"],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/locations/", {
          params: { query: { page_size: 100 } },
          signal,
        }),
      ).results,
  });
}

/** Human codes resolve only through the scoped exact `?code=` collection. */
export async function findLot(scope: AllocationScope, code: string, signal: AbortSignal) {
  const page = unwrap(
    await scope.client.GET("/api/v1/lots/", { params: { query: { code, page_size: 1 } }, signal }),
  );
  return page.results.find((lot) => lot.code === code) ?? null;
}

export async function findBag(scope: AllocationScope, code: string, signal: AbortSignal) {
  const page = unwrap(
    await scope.client.GET("/api/v1/bags/", { params: { query: { code, page_size: 1 } }, signal }),
  );
  return page.results.find((bag) => bag.code === code) ?? null;
}

/** Display names for rows; a missing or forbidden directory falls back to short ids, never blocks. */
export function lotDirectoryOptions(scope: AllocationScope, route: string) {
  return inventoryScopedOptions(allocationRouteScope(scope, route), {
    key: ["allocation", "lots"],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/lots/", { params: { query: { page_size: 100 } }, signal }),
      ).results,
  });
}

export function courierDirectoryOptions(scope: AllocationScope, route: string) {
  return inventoryScopedOptions(allocationRouteScope(scope, route), {
    key: ["allocation", "couriers", "directory"],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/users/operational/", {
          params: { query: { is_active: true, page_size: 100 } },
          signal,
        }),
      ).results,
  });
}

/** Signature state needs the reconciliation read; without that permission it is reported unknown. */
export function assignmentFrameOptions(scope: AllocationScope, assignmentId: string) {
  const options = inventoryScopedOptions(allocationRouteScope(scope, ASSIGNMENTS_ROUTE), {
    key: ["allocation", "assignment-frame", assignmentId],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/reconciliations/", {
          params: { query: { assignment: assignmentId, page_size: 1 } },
          signal,
        }),
      ).results[0] ?? null,
  });
  return {
    ...options,
    enabled:
      options.enabled &&
      assignmentId !== "" &&
      scope.identity.permissions?.includes("inventory.reconcile") === true,
  };
}
