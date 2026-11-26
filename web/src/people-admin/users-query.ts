import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { TableState } from "../data-table/table-types";
import { toFilterParams } from "../data-table/table-state";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { IS_ACTIVE_PARAM, USERS_PAGE_SIZE } from "./users-table";

export type Person = Schemas["Personnel"];
const PICKER_PAGE_SIZE = 200;
const MAX_PAGES = 20;

/** `GET /api/v1/users/` for the table state in the URL. */
export function usersQueryOptions(client: ApiClient, identity: SessionIdentity, state: TableState) {
  const isActive = state.filters[IS_ACTIVE_PARAM];
  const filters = Object.fromEntries(
    Object.entries(toFilterParams(state)).filter(([key]) => key !== IS_ACTIVE_PARAM),
  );
  return orgScopedQueryOptions(identity, {
    key: ["users", "list", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/users/", {
          params: {
            query: {
              page: state.page,
              page_size: USERS_PAGE_SIZE,
              ...filters,
              ...(isActive === undefined ? {} : { is_active: isActive === "true" }),
            },
          },
          signal,
        }),
      ),
  });
}

export function personQueryOptions(client: ApiClient, identity: SessionIdentity, id: string) {
  return orgScopedQueryOptions(identity, {
    key: ["users", "record", id],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/users/{id}/", { params: { path: { id } }, signal })),
  });
}

/** Profiles of every membership, to show names instead of codes. */
export function membershipProfilesOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["users", "memberships"],
    queryFn: async ({ signal }) => {
      const rows: Schemas["Membership"][] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const answer = unwrap(
          await client.GET("/api/v1/memberships/", {
            params: { query: { page, page_size: PICKER_PAGE_SIZE } },
            signal,
          }),
        );
        rows.push(...answer.results);
        if (!answer.next) break;
      }
      return rows;
    },
  });
}

export function profilesOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["users", "profiles"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/roles/", {
          params: { query: { page: 1, page_size: PICKER_PAGE_SIZE } },
          signal,
        }),
      ).results,
  });
}
