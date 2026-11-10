import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { LabScope } from "./lab-query";

const RECENT_PAGE_SIZE = 50;

/** The newest counts of the lab; the side card shows 5 and the header counts today's. */
export function recentCountsOptions(scope: LabScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "recent-counts"],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/egg-counts/", {
          params: {
            query: {
              ...(scope.identity.activeCenter ? { center: scope.identity.activeCenter } : {}),
              ordering: "-created_at",
              page: 1,
              page_size: RECENT_PAGE_SIZE,
            },
          },
          signal,
        }),
      ),
  });
}

/** Counts carry only the bag id; the code comes from the bag record. */
export function bagCodeOptions(scope: LabScope, id: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "bag-code", id],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/bags/{id}/", { params: { path: { id } }, signal }))
        .code,
  });
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}
