import { useRef } from "react";
import { useSessionGuard } from "../../session/use-session-guard";
import type { ReviewScope } from "./review-query";

/** Authorization and center changes retire publication even when the cookie identity stays equal. */
export function useReviewGuard(scope: ReviewScope) {
  const beginSession = useSessionGuard();
  const context = JSON.stringify([
    scope.identity.userId,
    scope.identity.organizationSlug,
    scope.identity.authorization,
    scope.identity.activeCenter,
  ]);
  const current = useRef({ context, epoch: 0 });
  if (current.current.context !== context)
    current.current = { context, epoch: current.current.epoch + 1 };
  const epoch = current.current.epoch;
  return {
    context: JSON.stringify([context, epoch]),
    begin: () => {
      const session = beginSession();
      return {
        signal: session.signal,
        isStale: () => session.isStale() || epoch !== current.current.epoch,
      };
    },
  };
}
