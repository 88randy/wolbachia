import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { RegScope } from "../../regulatory/reg-queries";

export type ApiKeyRow = Schemas["ApiKey"];

export const API_KEY_READ = "api_key.read";
export const API_KEY_MANAGE = "api_key.manage";

/** The data an institution may be allowed to read: the indicators of the public portal. */
export const API_KEY_ENDPOINTS = [
  "releases_total",
  "quadrants_covered",
  "readings_total",
  "egg_positivity",
  "releases_by_week",
  "coverage",
] as const;

const STATUSES = ["active", "scheduled", "expired", "revoked"] as const;

export const API_KEY_TABLE: TableQueryConfig = {
  paging: "cursor",
  pageSize: 25,
  sortableIds: [],
  supportsVoided: false,
  filters: [
    {
      kind: "text",
      key: "search",
      labelKey: "apiKeys.search",
      maxLength: 80,
      input: "search",
    },
    {
      kind: "select",
      key: "status",
      labelKey: "apiKeys.statusLabel",
      presentation: "segmented",
      options: STATUSES.map((value) => ({ value, labelKey: `apiKeys.status.${value}` as const })),
    },
  ],
};

/** Keys sit under the `regulatory` prefix so the shared action hook refreshes them. */
export function apiKeyOptions({ client, identity }: RegScope, state: TableState) {
  const status = STATUSES.find((candidate) => candidate === state.filters["status"]);
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "api-keys", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/api-keys/", {
          params: {
            query: {
              ...(state.cursor === null ? {} : { cursor: state.cursor }),
              search: state.filters["search"],
              status,
            },
          },
          signal,
        }),
      ),
  });
}
