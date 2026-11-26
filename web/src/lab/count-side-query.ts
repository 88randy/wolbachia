import { calendarDayOf, todayIn } from "../format/time-zone";
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

/** Whether an instant falls on today's date in the organization's zone. */
export function isToday(iso: string, timeZone: string, now: Date = new Date()): boolean {
  return calendarDayOf(iso, timeZone) === todayIn(timeZone, now);
}
