import { ApiError, unwrap } from "@wolbachia/api-client";
import type { operations, Schemas } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "../inventory-read-context";
import type { InventoryScope } from "../inventory-query";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { transferRouteScope } from "./transfer-route-scope";

export type Discrepancy = Schemas["Discrepancy"];
export const DISCREPANCY_PAGE_SIZE = 25;
type ListQuery = NonNullable<operations["discrepancies_list"]["parameters"]["query"]>;
export const DISCREPANCY_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: DISCREPANCY_PAGE_SIZE,
  supportsVoided: false,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at", "code"],
  sortOptions: [
    { value: "created_at", labelKey: "discrepancies.field.createdAt" },
    { value: "code", labelKey: "discrepancies.field.code" },
  ],
  filters: [
    {
      kind: "text",
      key: "transfer",
      labelKey: "discrepancies.field.transfer",
      maxLength: 36,
      input: "hidden",
    },
    { kind: "text", key: "code", labelKey: "discrepancies.field.code", maxLength: 120 },
    { kind: "text", key: "search", labelKey: "discrepancies.field.search", maxLength: 200 },
    {
      kind: "select",
      key: "status",
      labelKey: "discrepancies.field.status",
      presentation: "segmented",
      options: [
        { value: "open", labelKey: "discrepancies.status.open" },
        { value: "closed", labelKey: "discrepancies.status.closed" },
      ],
    },
  ],
};
function listParams(state: TableState): ListQuery {
  return {
    ...state.filters,
    page: state.page,
    page_size: DISCREPANCY_PAGE_SIZE,
    status: state.filters["status"] as ListQuery["status"],
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
export function discrepancyListOptions(scope: InventoryScope, state: TableState) {
  return inventoryScopedOptions(transferRouteScope(scope, "discrepancies"), {
    key: ["transfers", "discrepancies", listParams(state)],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/discrepancies/", {
          params: { query: listParams(state) },
          signal,
        }),
      ),
  });
}
/** Human codes resolve only inside the already authorized collection. */
export function discrepancyRecordOptions(scope: InventoryScope, code: string) {
  return inventoryScopedOptions(transferRouteScope(scope, "discrepancies", code), {
    key: ["transfers", "discrepancy", code],
    queryFn: async ({ signal }) => {
      const page = unwrap(
        await scope.client.GET("/api/v1/discrepancies/", {
          params: { query: { code, page: 1 } },
          signal,
        }),
      );
      const row = page.results.find((item) => item.code === code);
      if (!row) return null;
      return unwrap(
        await scope.client.GET("/api/v1/discrepancies/{id}/", {
          params: { path: { id: row.id } },
          signal,
        }),
      );
    },
  });
}
export function isDiscrepancyDenied(error: unknown) {
  return error instanceof ApiError && [403, 404].includes(error.status);
}
