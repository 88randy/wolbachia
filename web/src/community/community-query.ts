import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { toFilterParams } from "../data-table/table-state";
import type { TableQueryConfig, TableState } from "../data-table/table-types";
import { invalidateOrgScoped, orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";

export type CommunityActivity = Schemas["CommunityActivity"];
export type CommunityZone = Schemas["CommunityZoneOption"];

const ROOT = "community";
export const COMMUNITY_PAGE_SIZE = 25;
const OPTIONS_PAGE_SIZE = 200;
export const COMMUNITY_READ = "community_activity.read";
export const COMMUNITY_CREATE = "community_activity.create";
export const COMMUNITY_VOID = "community_activity.void";

export const COMMUNITY_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: COMMUNITY_PAGE_SIZE,
  defaultOrdering: "-activity_date",
  sortableIds: ["activity_date", "attendance"],
  supportsVoided: true,
  filters: [],
};

export function activitiesOptions(client: ApiClient, identity: SessionIdentity, state: TableState) {
  const query = { page: state.page, page_size: COMMUNITY_PAGE_SIZE, ...toFilterParams(state) };
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "list", state],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/community-activities/", { params: { query }, signal })),
  });
}

/** Active activity types (a catalog) and the zones the user may record in, for the form pickers. */
export function activityChoicesOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "choices"],
    queryFn: async ({ signal }) => {
      const [types, zones] = await Promise.all([
        client.GET("/api/v1/catalogs/{catalog_slug}/items/", {
          params: {
            path: { catalog_slug: "community-activity-type" },
            query: { page_size: OPTIONS_PAGE_SIZE },
          },
          signal,
        }),
        client.GET("/api/v1/community-activities/zone-options/", {
          params: { query: { action: "create", page_size: OPTIONS_PAGE_SIZE } },
          signal,
        }),
      ]);
      return {
        types: unwrap(types).results.filter((item) => item.is_active),
        zones: unwrap(zones).results,
      };
    },
  });
}

export function invalidateCommunity(queryClient: QueryClient): Promise<void> {
  return invalidateOrgScoped(queryClient, ROOT);
}
