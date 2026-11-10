import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@wolbachia/api-client";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { reportSessionError } from "../../session/session-events";
import { inventoryFailure } from "../inventory-failure";
import { runIntent } from "./allocation-intent";
import type { IntentDraft, IntentResult } from "./allocation-intent";
import type { AllocationScope } from "./allocation-query";

const HTTP_SERVER_ERROR = 500;
const HTTP_RATE_LIMIT = 429;
/** A confirmed client-side rejection changed nothing: the corrected form becomes a new command. */
function isConfirmedRejection(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status < HTTP_SERVER_ERROR &&
    error.status !== HTTP_RATE_LIMIT
  );
}

interface Runtime {
  scope: AllocationScope;
  cache: QueryClient;
  busy: { current: boolean };
  frozen: { current: IntentDraft | null };
  setBusy: (busy: boolean) => void;
  setFailure: (failure: unknown) => void;
  setResult: (result: IntentResult | undefined) => void;
}

async function perform(run: Runtime, draft: IntentDraft) {
  const guard = run.scope.beginWrite();
  if (guard.isStale()) return;
  const command = (run.frozen.current ??= draft);
  run.busy.current = true;
  run.setBusy(true);
  run.setFailure(undefined);
  run.setResult(undefined);
  const isCurrent = () => !guard.isStale() && run.scope.isCurrentRead();
  try {
    const call = { client: run.scope.client, signal: guard.signal };
    const outcome = await runIntent(call, command, (stored, id) => {
      stored.intentId = id;
    });
    if (!isCurrent()) return;
    run.frozen.current = null;
    run.setResult(outcome);
    void invalidateOrgScoped(run.cache, "allocation");
  } catch (error) {
    if (!isCurrent()) return;
    run.setFailure(error);
    reportSessionError(error, run.cache);
    if (isConfirmedRejection(error)) run.frozen.current = null;
    void invalidateOrgScoped(run.cache, "allocation");
  } finally {
    run.busy.current = false;
    if (!guard.isStale()) run.setBusy(false);
  }
}

/**
 * Sends one prepared-intent command. A failed command stays frozen (same command id): only the
 * explicit retry resends it, and reauthentication never replays it. A confirmed rejection (such as
 * a revision conflict) refreshes the reads and releases the draft; the form keeps what was typed.
 */
export function useAllocationCommand(scope: AllocationScope) {
  const cache = useQueryClient();
  const busy = useRef(false);
  const frozen = useRef<IntentDraft | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [result, setResult] = useState<IntentResult>();
  const run: Runtime = { scope, cache, busy, frozen, setBusy, setFailure, setResult };
  const canSend = () =>
    !busy.current && scope.identity.isSettled && scope.isCurrentRead() && navigator.onLine;
  return {
    isBusy,
    result,
    failure: failure === undefined ? undefined : inventoryFailure(failure),
    isFrozen: frozen.current !== null && failure !== undefined,
    send: (draft: IntentDraft) => (canSend() ? perform(run, draft) : Promise.resolve()),
    retry: () => (frozen.current && canSend() ? perform(run, frozen.current) : Promise.resolve()),
  };
}
