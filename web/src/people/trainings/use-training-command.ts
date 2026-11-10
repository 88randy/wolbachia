import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { TRAINING_RESOURCE } from "./training-query";
import { reportSessionError } from "../../session/session-events";
import { usePeopleGuard } from "../use-people-guard";
import type { TrainingScope } from "./training-query";
type Receipt = Schemas["PeopleReceipt"];
interface Status {
  isSaving: boolean;
  error?: unknown;
  receipt?: Receipt;
  requiresReview: boolean;
}
interface Attempt {
  guard: SessionGuard;
  cache: QueryClient;
  setStatus: (status: Status) => void;
}
interface Runtime extends Omit<Attempt, "guard"> {
  begin: () => SessionGuard;
  busy: RefObject<symbol | null>;
  status: Status;
}
async function performCommand(
  attempt: Attempt,
  execute: (signal: AbortSignal) => Promise<Receipt>,
) {
  try {
    const receipt = await execute(attempt.guard.signal);
    if (attempt.guard.isStale()) return false;
    attempt.setStatus({ isSaving: false, receipt, requiresReview: false });
    void invalidateOrgScoped(attempt.cache, TRAINING_RESOURCE);
    return true;
  } catch (error) {
    if (!attempt.guard.isStale()) {
      attempt.setStatus({ isSaving: false, error, requiresReview: true });
      reportSessionError(error, attempt.cache);
    }
    return false;
  }
}
async function issueCommand(runtime: Runtime, execute: (signal: AbortSignal) => Promise<Receipt>) {
  if (runtime.busy.current || runtime.status.requiresReview || runtime.status.receipt) return false;
  const guard = runtime.begin();
  if (guard.isStale()) return false;
  const token = Symbol();
  runtime.busy.current = token;
  runtime.setStatus({ isSaving: true, requiresReview: false });
  try {
    return await performCommand({ ...runtime, guard }, execute);
  } finally {
    settleCommand(runtime, { token, guard });
  }
}
function settleCommand(runtime: Runtime, frame: { token: symbol; guard: SessionGuard }) {
  if (runtime.busy.current !== frame.token) return;
  runtime.busy.current = null;
  if (frame.guard.isStale()) runtime.setStatus({ isSaving: false, requiresReview: true });
}
function useCommandState(context: string, revision: number) {
  const busy = useRef<symbol | null>(null);
  const [status, setStatus] = useState<Status>({ isSaving: false, requiresReview: false });
  useEffect(() => {
    if (busy.current) {
      busy.current = null;
      setStatus({ isSaving: false, requiresReview: true });
    }
  }, [context, revision]);
  return { busy, status, setStatus };
}
/** No replay queue: failures require deliberate history review before another submission. */
export function useTrainingCommand(scope: TrainingScope) {
  const { begin, context } = usePeopleGuard(scope.identity);
  const cache = useQueryClient();
  const { busy, status, setStatus } = useCommandState(context, scope.identity.revision);
  const runtime = { begin, cache, busy, status, setStatus };
  const send = (execute: (signal: AbortSignal) => Promise<Receipt>) =>
    issueCommand(runtime, execute);
  function review() {
    void invalidateOrgScoped(cache, TRAINING_RESOURCE);
    setStatus({ isSaving: false, requiresReview: false });
  }
  return {
    ...status,
    send,
    review,
    isDenied: status.error instanceof ApiError && [403, 404].includes(status.error.status),
  };
}
