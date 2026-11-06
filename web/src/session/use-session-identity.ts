import { useActiveCenter } from "../centers/use-active-center";
import { hasCenterScope, authorizationKey } from "../centers/center-selection";
import { useSyncExternalStore } from "react";
import { sessionIdentityOf } from "./org-scoped-query";
import type { SessionIdentity } from "./org-scoped-query";
import { currentRevision, isSessionKnown, subscribeToRevision } from "./session-revision";
import { useMe } from "./use-me";

/**
 * The identity of the signed-in session, for `orgScopedQueryOptions`. It re-renders the screen
 * when the session revision changes or the tab starts or stops reconciling with `/me/`.
 */
export function useSessionIdentity(): SessionIdentity {
  const me = useMe();
  const revision = useSyncExternalStore(subscribeToRevision, currentRevision);
  const isKnown = useSyncExternalStore(subscribeToRevision, isSessionKnown);
  const activeCenter = useActiveCenter();
  return {
    ...sessionIdentityOf(me, revision, isKnown),
    activeCenter,
    authorization: authorizationKey(me),
    hasScope: hasCenterScope(me.scope),
    permissions: me.permissions,
  };
}
