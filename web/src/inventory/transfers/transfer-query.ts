import { unwrap } from "@wolbachia/api-client";
import type { Schemas, operations } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "../inventory-read-context";
import type { useInventoryContext } from "../use-inventory-context";
import type { TableState } from "../../data-table/table-types";
import { transferRouteScope } from "./transfer-route-scope";

export type Transfer = Schemas["Transfer"];
export type TransferScope = ReturnType<typeof useInventoryContext>;
type TransferQuery = NonNullable<operations["transfers_list"]["parameters"]["query"]>;
export const TRANSFER_PAGE_SIZE = 25;

export function transferListOptions(scope: TransferScope, state: TableState) {
  const query = transferParams(state);
  return inventoryScopedOptions(transferRouteScope(scope, "transfers"), {
    key: ["transfers", "list", query],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/transfers/", { params: { query }, signal })),
  });
}

function transferParams(state: TableState): TransferQuery {
  return {
    ...state.filters,
    ...(state.isSortExplicit && state.sort
      ? { ordering: `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}` }
      : {}),
    page: state.page,
    page_size: TRANSFER_PAGE_SIZE,
  };
}

/** Human codes resolve only through the scoped collection; unknown and foreign are identical. */
export function transferRecordOptions(scope: TransferScope, code: string) {
  return inventoryScopedOptions(transferRouteScope(scope, "transfers", code), {
    key: ["transfers", "record", code],
    queryFn: async ({ signal }) => {
      const found = unwrap(
        await scope.client.GET("/api/v1/transfers/", {
          params: { query: { code, page: 1, page_size: 1 } },
          signal,
        }),
      ).results.find((row) => row.code === code);
      if (!found) return null;
      return unwrap(
        await scope.client.GET("/api/v1/transfers/{id}/", {
          params: { path: { id: found.id } },
          signal,
        }),
      );
    },
  });
}
