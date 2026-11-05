import { useWriteCooldown } from "./use-write-cooldown";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { ApiError } from "@wolbachia/api-client";
import { useSessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { GEOGRAPHY } from "./geography-query";
import { sendAttempt } from "./write-attempt";
import type { WriteReply, WriteOutcome } from "./write-result";
/** One explicit write. Stale responses cannot report session errors or refresh another scope. */
export function useGeographyWrite<T>() {
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  const cooldown = useWriteCooldown();
  const busy = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<WriteOutcome<T> | null>(null);
  const clear = () => {
    setOutcome(null);
  };
  const execute = async (send: (signal: AbortSignal) => Promise<WriteReply<T>>) => {
    if (busy.current || !cooldown.canStart()) return { kind: "stale" } as const;
    const guard = begin();
    if (guard.isStale()) return { kind: "stale" } as const;
    busy.current = true;
    setBusy(true);
    const result = await sendAttempt({ send, guard, report: sessionReporter(queryClient) });
    busy.current = false;
    if (!guard.signal.aborted) setBusy(false);
    if (guard.isStale()) return { kind: "stale" } as const;
    cooldown.receive(result);
    setOutcome(result);
    if (result.kind === "saved") void invalidateOrgScoped(queryClient, GEOGRAPHY);
    return result;
  };
  return { isBusy, outcome, execute, clear, retryAt: cooldown.retryAt };
}
function sessionReporter(queryClient: QueryClient) {
  return (error: ApiError) => {
    reportSessionError(error, queryClient);
  };
}
