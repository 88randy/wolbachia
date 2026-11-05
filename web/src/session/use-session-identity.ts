import { useSyncExternalStore } from "react";
import { sessionIdentityOf } from "./org-scoped-query";
import type { SessionIdentity } from "./org-scoped-query";
import {
  currentRevision,
  isReconcilingSession,
  isSessionUnknown,
  subscribeToRevision,
} from "./session-revision";
import { useMe } from "./use-me";

/**
 * The identity of the signed-in session, for `orgScopedQueryOptions`. It re-renders the screen
 * when the session revision changes or the tab starts or stops reconciling with `/me/`.
 */
export function useSessionIdentity(): SessionIdentity {
  const me = useMe();
  const revision = useSyncExternalStore(subscribeToRevision, currentRevision);
  const isReconciling = useSyncExternalStore(subscribeToRevision, isReconcilingSession);
  const isUnknown = useSyncExternalStore(subscribeToRevision, isSessionUnknown);
  return sessionIdentityOf(me, revision, !isReconciling && !isUnknown);
}
