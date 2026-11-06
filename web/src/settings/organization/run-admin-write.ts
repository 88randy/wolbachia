import { ApiError } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import type { SessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import { adminErrorKey } from "./admin-error";
import type { AdminWriteState } from "./use-admin-write-state";
interface Options<T> {
  request: (guard: SessionGuard) => Promise<T>;
  begin: () => SessionGuard;
  state: AdminWriteState;
  queryClient: QueryClient;
  lock: RefObject<boolean>;
}
interface Failure {
  guard: SessionGuard;
  error: unknown;
  state: AdminWriteState;
  queryClient: QueryClient;
}
function reportFailure({ guard, error, state, queryClient }: Failure) {
  if (guard.isStale()) return;
  state.setError(adminErrorKey(error));
  // Only explicit review can clear a revision conflict, including after a failed refresh.
  if (error instanceof ApiError && error.code === "stale_revision") state.setNeedsReview(true);
  reportSessionError(error, queryClient);
}
/** One guarded attempt. Completing a stale attempt releases the lock without publishing its answer. */
export async function runAdminWrite<T>({
  request,
  begin,
  state,
  queryClient,
  lock,
}: Options<T>): Promise<T | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  const guard = begin();
  state.setBusy(true);
  state.setError(null);
  try {
    const result = await request(guard);
    return guard.isStale() ? undefined : result;
  } catch (error) {
    reportFailure({ guard, error, state, queryClient });
    return undefined;
  } finally {
    lock.current = false;
    state.setBusy(false);
  }
}
