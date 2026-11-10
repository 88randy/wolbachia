import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
/** Retire every obsolete authorization entry without creating a session-state writer. */
export function useEvaluationScope() {
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const cache = useQueryClient();
  const { authorization, activeCenter, userId, organizationSlug } = scope.identity;
  useLayoutEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }) =>
        query.queryKey[3] === "evaluations" &&
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
