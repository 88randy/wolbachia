import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { toFilterParams } from "../../data-table/table-state";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { invalidateOrgScoped, orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";

export type PermitType = Schemas["PermitType"];
export type Permit = Schemas["Permit"];
export type PermitVersion = Schemas["PermitVersion"];

const ROOT = "permits";
export const PERMITS_PAGE_SIZE = 25;
/** Backend `MAX_PAGE_SIZE`: the option lists of the form read one page of this size. */
const OPTIONS_PAGE_SIZE = 200;

export const PERMIT_TYPES_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PERMITS_PAGE_SIZE,
  defaultOrdering: "code",
  sortableIds: ["code", "name", "created_at"],
  supportsVoided: false,
  filters: [{ kind: "text", key: "search", maxLength: 100, labelKey: "permits.types.search" }],
};

export const PERMITS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PERMITS_PAGE_SIZE,
  defaultOrdering: "-created_at",
  sortableIds: ["code", "created_at"],
  supportsVoided: false,
  filters: [{ kind: "text", key: "search", maxLength: 100, labelKey: "permits.list.search" }],
};

function listQuery(state: TableState) {
  return { page: state.page, page_size: PERMITS_PAGE_SIZE, ...toFilterParams(state) };
}

export function permitTypesOptions(
  client: ApiClient,
  identity: SessionIdentity,
  state: TableState,
) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "types", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/permit-types/", { params: { query: listQuery(state) }, signal }),
      ),
  });
}

export function permitsOptions(client: ApiClient, identity: SessionIdentity, state: TableState) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "list", state],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/permits/", { params: { query: listQuery(state) }, signal })),
  });
}

/** Scoped human-code lookup, then the detail by id; an unknown or foreign code is `null`. */
export function permitRecordOptions(client: ApiClient, identity: SessionIdentity, code: string) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "record", code],
    queryFn: async ({ signal }): Promise<Permit | null> => {
      const page = unwrap(
        await client.GET("/api/v1/permits/", { params: { query: { code, page: 1 } }, signal }),
      );
      const found = page.results.find((row) => row.code === code);
      if (!found) return null;
      const detail = unwrap(
        await client.GET("/api/v1/permits/{id}/", { params: { path: { id: found.id } }, signal }),
      );
      return detail.id === found.id && detail.code === code ? detail : null;
    },
  });
}

/** Choices of the permit form: types and quadrants inside the user's scope. */
export function permitFormChoicesOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "choices"],
    queryFn: async ({ signal }) => {
      const query = { page: 1, page_size: OPTIONS_PAGE_SIZE };
      const [types, quadrants] = await Promise.all([
        client.GET("/api/v1/permit-types/", { params: { query }, signal }),
        client.GET("/api/v1/lookups/quadrants/", { params: { query }, signal }),
      ]);
      return { types: unwrap(types).results, quadrants: unwrap(quadrants).results };
    },
  });
}

export function invalidatePermits(queryClient: QueryClient): Promise<void> {
  return invalidateOrgScoped(queryClient, ROOT);
}
