import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import { useCan } from "../session/use-can";
import { useSessionIdentity } from "../session/use-session-identity";

/** "Lo que tienes pendiente": how many records wait for this person, one cheap count per list. */
export function usePendingCounts() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const can = useCan();
  const gated = <T>(allowed: boolean, options: ReturnType<typeof orgScopedQueryOptions<T>>) => ({
    ...options,
    enabled: options.enabled && allowed,
  });
  const reviews = useQuery(
    gated(
      can("review_item.read"),
      orgScopedQueryOptions(identity, {
        key: ["reviews", "count", "in_review"],
        queryFn: async ({ signal }) =>
          unwrap(
            await client.GET("/api/v1/review-items/", {
              params: { query: { kind: "in_review", page_size: 1 } },
              signal,
            }),
          ).count,
      }),
    ),
  );
  const relocations = useQuery(
    gated(
      can("relocation.read"),
      orgScopedQueryOptions(identity, {
        key: ["relocations", "count", "pending"],
        queryFn: async ({ signal }) =>
          unwrap(
            await client.GET("/api/v1/relocations/", {
              params: { query: { status: "pending", page_size: 1 } },
              signal,
            }),
          ).count,
      }),
    ),
  );
  const live = useQuery(
    gated(
      can("shift.read"),
      orgScopedQueryOptions(identity, {
        key: ["shifts", "count", "open"],
        queryFn: async ({ signal }) =>
          unwrap(
            await client.GET("/api/v1/shifts/", {
              params: { query: { status: "open", page_size: 1 } },
              signal,
            }),
          ).count,
      }),
    ),
  );
  return { reviews: reviews.data, relocations: relocations.data, live: live.data };
}
