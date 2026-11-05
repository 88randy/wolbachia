import { useGeographyCache } from "./use-geography-cache";
import { useApiClient } from "../../api/ApiClientProvider";
import { useMe } from "../../session/use-me";
import { useSessionIdentity } from "../../session/use-session-identity";
import {
  geographyContext,
  hasGeographyAccess,
  QUADRANT_PUBLISH,
  POINT_CREATE,
} from "./permissions";
/** Read-only session projection; never calls a session mutator. */
export function useGeographyScope() {
  const client = useApiClient();
  const me = useMe();
  const identity = useSessionIdentity();
  const context = geographyContext(me);
  useGeographyCache(context);
  const canRead = hasGeographyAccess(me);
  return {
    client,
    me,
    identity: { ...identity, isSettled: identity.isSettled && canRead },
    context,
    canRead,
    canPublish: canRead && me.permissions.includes(QUADRANT_PUBLISH),
    canCreatePoint: canRead && me.permissions.includes(POINT_CREATE),
    canCreateQuadrant:
      canRead && me.permissions.includes(QUADRANT_PUBLISH) && me.scope.quadrants.mode === "all",
  };
}
export type GeographyScope = ReturnType<typeof useGeographyScope>;
