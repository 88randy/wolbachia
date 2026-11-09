import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import type { TableState } from "../data-table/table-types";
import { SHIFT_PAGE_SIZE } from "./shifts-table";

let shiftReadSequence = 0;
/** Read attempts are ordered by issue, so a pre-failure in-flight GET cannot authorize replay. */
export function currentShiftReadSequence() { return shiftReadSequence; }

export function shiftOptions(client: ApiClient, identity: SessionIdentity, id: string) {
  return orgScopedQueryOptions(identity, {
    key: ["shifts", "detail", id],
    queryFn: async ({ signal }) => {
      const readSequence = ++shiftReadSequence;
      const shift = unwrap(await client.GET("/api/v1/shifts/{id}/", {
        params: { path: { id } }, signal,
      }));
      return { shift, readSequence };
    },
  });
}
/** Only server-supported filtering and paging; no client table scans or invented ordering. */
export function shiftsOptions(client: ApiClient, identity: SessionIdentity, state: TableState) {
  const status = state.filters["status"];
  return orgScopedQueryOptions(identity, {
    key: ["shifts", "list", state],
    queryFn: async ({ signal }) => unwrap(await client.GET("/api/v1/shifts/", {
      params: { query: { page: state.page, page_size: SHIFT_PAGE_SIZE,
        ...(status === "open" || status === "closed" ? { status } : {}),
      } }, signal,
    })),
  });
}
