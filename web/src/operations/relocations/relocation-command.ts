import { unwrap, ApiError } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import type { RelocationScope } from "./relocations-query";
import { RELOCATIONS } from "./relocations-query";
export interface RelocationCommand {
  id: string;
  decision: "approve" | "reject";
  reason: string;
}
export interface RelocationFailure {
  code: string;
  isConflict: boolean;
  error?: unknown;
}
export interface CommandContext {
  scope: RelocationScope;
  cache: QueryClient;
  begin: () => SessionGuard;
  lock: { current: boolean };
  failure: RelocationFailure | null;
  setBusy: (busy: boolean) => void;
  setFailure: (failure: RelocationFailure | null) => void;
  setReceipt: (receipt: Schemas["RelocationDecisionResult"]) => void;
}
/** B33 undecided proposal revision zero becomes one immutable decision at revision one. */
export async function postRelocation(
  scope: RelocationScope,
  command: RelocationCommand,
  signal: AbortSignal,
) {
  const path =
    command.decision === "approve"
      ? "/api/v1/relocations/{id}/approve/"
      : "/api/v1/relocations/{id}/reject/";
  return unwrap(
    await scope.client.POST(path, {
      params: { path: { id: command.id } },
      body: { expected_revision: 0, reason: command.reason },
      signal,
    }),
  );
}
function receiveFailure(context: CommandContext, error: unknown) {
  const isConflict = error instanceof ApiError && error.status === 409;
  context.setFailure({
    code: error instanceof ApiError ? error.code : "unknown_error",
    isConflict,
    error,
  });
  reportSessionError(error, context.cache);
  if (isConflict) void invalidateOrgScoped(context.cache, RELOCATIONS);
}
export async function runRelocationCommand(context: CommandContext, command: RelocationCommand) {
  if (!canStartCommand(context)) return;
  const guard = context.begin();
  if (guard.isStale()) return;
  context.lock.current = true;
  context.setBusy(true);
  try {
    const result = await postRelocation(context.scope, command, guard.signal);
    if (guard.isStale()) return;
    context.setReceipt(result);
    void invalidateOrgScoped(context.cache, RELOCATIONS);
  } catch (error) {
    if (!guard.isStale()) receiveFailure(context, error);
  } finally {
    if (!guard.isStale()) {
      context.lock.current = false;
      context.setBusy(false);
    }
  }
}

function canStartCommand(context: CommandContext) {
  return (
    navigator.onLine &&
    !context.lock.current &&
    !context.failure &&
    context.scope.canDecide &&
    context.scope.identity.isSettled
  );
}
