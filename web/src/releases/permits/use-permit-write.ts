import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../../session/use-session-guard";
import type { SessionGuard } from "../../session/use-session-guard";
import { runPermitWrite } from "./permit-write";
import type { WriteOutcome } from "./permit-write";
import { invalidatePermits } from "./permits-query";

type Send = (guard: SessionGuard) => Promise<{ response: Response; error?: unknown }>;

/**
 * One guarded write. A stale answer (the session changed) touches nothing; a saved write or a 409
 * refreshes the permit queries so the screen shows the server's current state.
 */
export function usePermitWrite(): (send: Send) => Promise<WriteOutcome> {
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  return async (send) => {
    const guard = begin();
    const outcome = await runPermitWrite({ queryClient, guard, send: () => send(guard) });
    if (outcome.kind === "saved" || outcome.kind === "conflict")
      void invalidatePermits(queryClient);
    return outcome;
  };
}
