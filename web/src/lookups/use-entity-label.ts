import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import { useSessionIdentity } from "../session/use-session-identity";
import { ENTITY_SOURCES, isUuid } from "./entity-sources";
import { holdsAny } from "./lookup-permissions";
import type { EntityKind, EntityLabel } from "./entity-sources";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * The human name of a referenced record (`kind` + id). `undefined` while it loads or when it
 * cannot be resolved (no permission, deleted, not an id): callers then show "—", never the id.
 */
export function useEntityLabel(
  kind: EntityKind,
  id: string | null | undefined,
): EntityLabel | undefined {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const source = ENTITY_SOURCES[kind];
  const options = orgScopedQueryOptions(identity, {
    key: ["entity", kind, id ?? ""],
    queryFn: ({ signal }) => source.fetchOne(client, id ?? "", signal),
  });
  const allowed = holdsAny(identity.permissions, source.permission);
  const query = useQuery({
    ...options,
    enabled: options.enabled && allowed && isUuid(id),
    staleTime: FIVE_MINUTES,
    retry: false,
  });
  return query.data;
}
