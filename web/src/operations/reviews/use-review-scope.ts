import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";

/** Permission-only changes retire old reads without creating another session writer. */
export function useReviewScope() {
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const cache = useQueryClient();
  const { authorization, activeCenter, userId, organizationSlug } = scope.identity;
  useLayoutEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }) =>
        query.queryKey[3] === "reviews" &&
        (query.queryKey[1] !== userId ||
          query.queryKey[2] !== organizationSlug ||
          query.meta?.["authorization"] !== authorization ||
          query.meta?.["center"] !== activeCenter),
    };
    void cache.cancelQueries(obsolete);
    cache.removeQueries(obsolete);
  }, [cache, authorization, activeCenter, userId, organizationSlug]);
  return scope;
}
