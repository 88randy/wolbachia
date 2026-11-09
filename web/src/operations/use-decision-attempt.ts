import { useRef, useState } from "react";
import { useSessionGuard } from "../session/use-session-guard";
import type { SessionGuard } from "../session/use-session-guard";
import { useSessionIdentity } from "../session/use-session-identity";
interface Attempt { revision: number; guard: SessionGuard }
/** A changed epoch retires the old owner immediately; its finally cannot unlock a new attempt. */
export function useDecisionAttempt() {
  const begin = useSessionGuard();
  const identity = useSessionIdentity();
  const owner = useRef<Attempt | undefined>(undefined);
  const [busyRevision, setBusyRevision] = useState<number>();
  const isBusy = busyRevision === identity.revision;
  const isRetired = busyRevision !== undefined && busyRevision !== identity.revision;
  const reset = () => { if (!isBusy) setBusyRevision(undefined); };
  const run = async (send: (guard: SessionGuard) => Promise<SessionGuard | false>) => {
    if (owner.current?.revision === identity.revision) return false;
    const attempt = { revision: identity.revision, guard: begin() };
    if (attempt.guard.isStale()) return false;
    owner.current = attempt;
    setBusyRevision(attempt.revision);
    try { return await send(attempt.guard); }
    finally {
      if (owner.current === attempt) {
        owner.current = undefined;
        if (!attempt.guard.isStale()) setBusyRevision(undefined);
      }
    }
  };
  return { isBusy, isRetired, reset, run };
}
