import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { isUuid } from "../../lookups/entity-sources";
import { CENTER_LOOKUP, QUADRANT_LOOKUP } from "../../lookups/lookup-sources";
import { toFilterParams } from "../../data-table/table-state";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";

export type Release = Schemas["Release"];

const ROOT = "releases";
export const RELEASES_PAGE_SIZE = 25;
export const RELEASE_READ = "release.read";

/** The list endpoint only orders by time, so the only header that sorts is the date. */
export const RELEASES_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: RELEASES_PAGE_SIZE,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at"],
  supportsVoided: false,
  filters: [
    {
      kind: "text",
      key: "center",
      labelKey: "releases.filter.center",
      maxLength: 36,
      input: "lookup",
      lookup: CENTER_LOOKUP,
    },
    {
      kind: "text",
      key: "quadrant",
      labelKey: "releases.filter.quadrant",
      maxLength: 36,
      input: "lookup",
      lookup: QUADRANT_LOOKUP,
    },
  ],
};

export function releasesOptions(client: ApiClient, identity: SessionIdentity, state: TableState) {
  const query = { page: state.page, page_size: RELEASES_PAGE_SIZE, ...toFilterParams(state) };
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "list", state],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/releases/", { params: { query }, signal })),
  });
}

/**
 * One release by its human code (`LIB-0042`): a scoped code lookup, then the detail by id. An old
 * link carrying the id still works. An unknown or foreign code is `null`.
 */
export function releaseOptions(client: ApiClient, identity: SessionIdentity, reference: string) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "record", reference],
    queryFn: async ({ signal }): Promise<Release | null> => {
      let id = reference;
      if (!isUuid(reference)) {
        const page = unwrap(
          await client.GET("/api/v1/releases/", {
            params: { query: { code: reference, page: 1 } },
            signal,
          }),
        );
        const found = page.results.find((row) => row.code === reference);
        if (!found) return null;
        id = found.id;
      }
      return unwrap(
        await client.GET("/api/v1/releases/{id}/", { params: { path: { id } }, signal }),
      );
    },
  });
}
