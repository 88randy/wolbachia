import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { TableState } from "../data-table/table-types";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { IS_REVOKED_PARAM, PHONES_PAGE_SIZE } from "./phones-table";

export type Phone = Schemas["Device"];

/** `GET /api/v1/devices/` for the table state in the URL (typed by the generated client). */
export function phonesQueryOptions(
  client: ApiClient,
  identity: SessionIdentity,
  state: TableState,
) {
  const isRevoked = state.filters[IS_REVOKED_PARAM];
  return orgScopedQueryOptions(identity, {
    key: ["devices", "list", state.page, isRevoked ?? null],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/devices/", {
          params: {
            query: {
              page: state.page,
              page_size: PHONES_PAGE_SIZE,
              ...(isRevoked === undefined ? {} : { is_revoked: isRevoked === "true" }),
            },
          },
          signal,
        }),
      ),
  });
}
