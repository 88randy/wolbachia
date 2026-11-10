import { useRef } from "react";
import { useSessionGuard } from "../session/use-session-guard";
import type { SessionIdentity } from "../session/org-scoped-query";
/** An authorization entry fences publication across permission/center ABA without writing session state. */
export function usePeopleGuard(identity: SessionIdentity) {
  const beginSession = useSessionGuard();
  const signature = JSON.stringify([
    identity.userId,
    identity.organizationSlug,
    identity.authorization,
    identity.activeCenter,
  ]);
  const current = useRef({ signature, entry: 0 });
  if (current.current.signature !== signature)
    current.current = { signature, entry: current.current.entry + 1 };
  const entry = current.current.entry;
  return {
    context: JSON.stringify([signature, entry]),
    begin: () => {
      const session = beginSession();
      return {
        signal: session.signal,
        isStale: () => session.isStale() || entry !== current.current.entry,
      };
    },
  };
}
