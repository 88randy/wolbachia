import { useCallback, useEffect, useRef } from "react";
import { currentRevision } from "./session-revision";

/** One request that must not outlive the session that started it. */
export interface SessionGuard {
  /** Pass it to the request: it is aborted when the component unmounts. */
  signal: AbortSignal;
  /** True once the session revision changed, or the component that sent the request is gone. */
  isStale: () => boolean;
}

/**
 * For requests made outside TanStack Query (a form's POST). `begin()` captures the session
 * revision (`session-revision.ts`: bumped on an accepted login, a confirmed sign-out and a
 * different identity in `/me/`, synchronously). A late answer asks `isStale()` BEFORE it reports an
 * error to the session, updates a form or invalidates queries. The revision is the only staleness
 * signal; nothing here reads React state. Unmounting aborts the requests (a screen that is gone,
 * or remounted for another record, has no use for the answer).
 */
export function useSessionGuard(): () => SessionGuard {
  const inFlight = useRef(new Set<AbortController>());
  useEffect(() => {
    const requests = inFlight.current;
    return () => {
      requests.forEach((controller) => {
        controller.abort();
      });
      requests.clear();
    };
  }, []);
  return useCallback(() => {
    const controller = new AbortController();
    inFlight.current.add(controller);
    const revision = currentRevision();
    return {
      signal: controller.signal,
      isStale: () => controller.signal.aborted || revision !== currentRevision(),
    };
  }, []);
}
