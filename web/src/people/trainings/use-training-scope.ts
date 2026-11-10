import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import { TRAINING_RESOURCE } from "./training-query";

/** Retire private answers on scope changes without becoming a session-state writer. */
export function useTrainingScope() {
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const cache = useQueryClient();
  const { userId, organizationSlug, authorization, activeCenter } = scope.identity;
  useLayoutEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }) =>
        query.queryKey[3] === TRAINING_RESOURCE &&
        (query.queryKey[1] !== userId ||
          query.queryKey[2] !== organizationSlug ||
          query.meta?.["authorization"] !== authorization ||
          query.meta?.["center"] !== activeCenter),
    };
    void cache.cancelQueries(obsolete);
    cache.removeQueries(obsolete);
  }, [cache, userId, organizationSlug, authorization, activeCenter]);
  return scope;
}
