import { useCallback, useEffect, useRef } from "react";
import { currentRevision } from "./session-revision";
import { useMe } from "./use-me";

/** One request that must not outlive the session that started it. */
export interface SessionGuard {
  /** Pass it to the request: it is aborted on unmount and when the identity changes. */
  signal: AbortSignal;
  /** True once the answer belongs to another session, user or organization (or the page left). */
  isStale: () => boolean;
}

/**
 * For requests made outside TanStack Query (a form's POST). `begin()` captures the session
 * revision (#28: changes on every accepted login and confirmed sign-out) and the identity (user
 * and organization). A late answer then asks `isStale()` BEFORE it reports an error to the
 * session, updates a form or invalidates queries, so a response of the old session can neither
 * expire the new one nor clear its cache. In-flight requests are aborted on unmount and when
 * the identity changes.
 */
export function useSessionGuard(): () => SessionGuard {
  const { user, organization } = useMe();
  const identity = `${user.id}|${organization?.slug ?? ""}`;
  const latest = useRef(identity);
  latest.current = identity;
  const inFlight = useRef(new Set<AbortController>());
  useEffect(() => {
    const requests = inFlight.current;
    return () => {
      requests.forEach((controller) => {
        controller.abort();
      });
      requests.clear();
    };
  }, [identity]);
  return useCallback(() => {
    const controller = new AbortController();
    inFlight.current.add(controller);
    const revision = currentRevision();
    const started = latest.current;
    return {
      signal: controller.signal,
      isStale: () =>
        controller.signal.aborted || revision !== currentRevision() || started !== latest.current,
    };
  }, []);
}
