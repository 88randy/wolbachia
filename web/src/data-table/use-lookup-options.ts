import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { holdsAny } from "../lookups/lookup-permissions";
import type { LookupSource } from "../lookups/lookup-sources";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import { useSessionIdentity } from "../session/use-session-identity";

/** First page of a picker's options for `search`, scoped to the session and its permission. */
export function useLookupOptions(source: LookupSource, search: string, enabled = true) {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const options = orgScopedQueryOptions(identity, {
    key: ["lookup", source.id, search],
    queryFn: ({ signal }) => source.fetch(client, search, signal),
  });
  const allowed = holdsAny(identity.permissions, source.permission);
  return useQuery({
    ...options,
    enabled: options.enabled && allowed && enabled,
    staleTime: 60_000,
  });
}
