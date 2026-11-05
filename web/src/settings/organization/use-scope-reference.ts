import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { useApiClient } from "../../api/ApiClientProvider";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useMe } from "../../session/use-me";
interface Reference {
  dimension: "centers" | "quadrants";
  id: string;
}
function referenceOptions(client: ApiClient, identity: SessionIdentity, reference: Reference) {
  return orgScopedQueryOptions(identity, {
    key: ["scope-references", reference.dimension, reference.id],
    queryFn: async ({ signal }) => {
      const params = { path: { id: reference.id } };
      if (reference.dimension === "centers") {
        const center = unwrap(await client.GET("/api/v1/centers/{id}/", { params, signal }));
        return `${center.code} · ${center.name}`;
      }
      return unwrap(await client.GET("/api/v1/quadrants/{id}/", { params, signal })).code;
    },
  });
}
/** Resolve retained ids to scoped human labels; foreign/unknown references share one fallback. */
export function useScopeReference(reference: Reference) {
  const permission = reference.dimension === "centers" ? "center.read" : "quadrant.read";
  const canRead = useMe().permissions.includes(permission);
  const options = referenceOptions(useApiClient(), useSessionIdentity(), reference);
  return useQuery({ ...options, enabled: options.enabled && canRead });
}
