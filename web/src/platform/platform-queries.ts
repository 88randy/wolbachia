import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { toFilterParams } from "../data-table/table-state";
import type { TableQueryConfig, TableState } from "../data-table/table-types";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";

export type PlatformOrganization = Schemas["PlatformOrganization"];
export type PlatformOrganizationDetail = Schemas["PlatformOrganizationDetail"];
export type ProvisionBody = Schemas["ProvisionRequest"];
export type ProvisionResponse = Schemas["ProvisionResponse"];

export const PLATFORM_RESOURCE = "platform";
export const PLATFORM_PAGE_SIZE = 25;
/** The wizard's own path: a slug with this value is refused by the wizard. */
export const NEW_ORGANIZATION_SEGMENT = "new-organization";

export interface PlatformScope {
  client: ApiClient;
  identity: SessionIdentity;
}

/** `GET /api/v1/platform/organizations/`: search, status tabs and column sorting on the server. */
export const PLATFORM_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PLATFORM_PAGE_SIZE,
  defaultOrdering: "name",
  sortableIds: ["name", "is_active", "users_count", "created_at"],
  supportsVoided: false,
  filters: [
    {
      kind: "text",
      key: "search",
      labelKey: "platform.list.search",
      maxLength: 80,
      input: "search",
    },
    {
      kind: "select",
      key: "status",
      labelKey: "platform.filter.status",
      presentation: "segmented",
      options: [
        { value: "active", labelKey: "platform.status.active" },
        { value: "suspended", labelKey: "platform.status.suspended" },
      ],
    },
  ],
};

export function platformListOptions({ client, identity }: PlatformScope, state: TableState) {
  return orgScopedQueryOptions(identity, {
    key: [PLATFORM_RESOURCE, "list", state],
    queryFn: async ({ signal }) => {
      const filters = toFilterParams(state);
      const status = filters["status"];
      return unwrap(
        await client.GET("/api/v1/platform/organizations/", {
          params: {
            query: {
              page: state.page,
              page_size: PLATFORM_PAGE_SIZE,
              ...filters,
              ...(status === "active" || status === "suspended" ? { status } : {}),
            },
          },
          signal,
        }),
      );
    },
  });
}

export function platformDetailOptions({ client, identity }: PlatformScope, slug: string) {
  return orgScopedQueryOptions(identity, {
    key: [PLATFORM_RESOURCE, "detail", slug],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/platform/organizations/{slug}/", {
          params: { path: { slug } },
          signal,
        }),
      ),
  });
}

/** Whether a slug and/or a username are still free (the server answers null for blanks). */
export async function checkAvailability(
  client: ApiClient,
  query: { slug?: string; username?: string },
  signal?: AbortSignal,
) {
  return unwrap(await client.GET("/api/v1/platform/availability/", { params: { query }, signal }));
}
