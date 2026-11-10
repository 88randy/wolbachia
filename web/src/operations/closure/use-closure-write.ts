import { useRef, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import type { GeographyScope } from "../../quadrants/geography/use-w-15";
import { sendCloseAttempt } from "./send-close-attempt";
export type ClosureResult =
  | { kind: "saved"; receipt: Schemas["QuadrantClosure"] }
  | { kind: "failed"; code: string }
  | { kind: "conflict" };
export interface CloseCommand {
  id: string;
  revision: number;
}
/** Exactly one explicit command; session/scope retirement aborts publication and never replays it. */
export function useClosureWrite(scope: GeographyScope, refresh: () => void) {
  const begin = useSessionGuard();
  const queryClient = useQueryClient();
  const pending = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const [result, setResult] = useState<ClosureResult | null>(null);
  async function close(command: CloseCommand) {
    if (pending.current || !navigator.onLine) return;
    const guard = begin();
    if (guard.isStale()) return;
    pending.current = true;
    setBusy(true);
    const outcome = await sendCloseAttempt({
      scope,
      command,
      guard,
      report: (error) => {
        reportSessionError(error, queryClient);
      },
    });
    pending.current = false;
    if (!guard.signal.aborted) setBusy(false);
    if (guard.isStale() || !outcome) return;
    setResult(outcome);
    refresh();
  }
  return { isBusy, result, close };
}
