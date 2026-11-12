import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { isUuid } from "../lookups/entity-sources";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { useSessionIdentity } from "../session/use-session-identity";

/** The id of the shift with this human code, or `null` when the code is unknown in the scope. */
export function shiftIdByCodeOptions(client: ApiClient, identity: SessionIdentity, code: string) {
  return orgScopedQueryOptions(identity, {
    key: ["shifts", "code", code],
    queryFn: async ({ signal }): Promise<string | null> => {
      const page = unwrap(
        await client.GET("/api/v1/shifts/", { params: { query: { code, page: 1 } }, signal }),
      );
      return page.results.find((row) => row.code === code)?.id ?? null;
    },
  });
}

export type ShiftReference =
  | { state: "loading" }
  | { state: "error"; retry: () => void }
  | { state: "unknown" }
  | { state: "ready"; id: string };

/** Turns the address segment (a code, or an id from an old link) into the shift id. */
export function useShiftReference(reference: string): ShiftReference {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const byId = isUuid(reference);
  const query = useQuery({
    ...shiftIdByCodeOptions(client, identity, reference),
    enabled: !byId,
  });
  if (byId) return { state: "ready", id: reference };
  if (query.isError)
    return {
      state: "error",
      retry: () => {
        void query.refetch();
      },
    };
  if (query.data === undefined) return { state: "loading" };
  return query.data === null ? { state: "unknown" } : { state: "ready", id: query.data };
}
