import { isSessionKnown } from "../../session/session-revision";
import { isLatest, readToken } from "../../session/session-controller";
import { CancelledError } from "@tanstack/react-query";
import { reconcileSession } from "../../session/session-reconcile";
import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { SessionGuard } from "../../session/use-session-guard";
import { fetchMeCommitted } from "../../session/me-query";
import { leaveKnown } from "../../session/session-controller";
import { reportSessionError } from "../../session/session-events";
interface Context {
  client: ApiClient;
  queryClient: QueryClient;
  guard: SessionGuard;
}
/** A saved administration change may revoke our access. Failed verification leaves the session closed. */
export async function refreshAdministration({
  client,
  queryClient,
  guard,
}: Context): Promise<void> {
  if (guard.isStale()) return;
  const token = readToken();
  try {
    await fetchMeCommitted({ client, queryClient, signal: guard.signal });
  } catch (error) {
    if (guard.isStale()) return;
    if (error instanceof CancelledError || !isLatest(token) || !isSessionKnown()) {
      await refreshAfterCancellation({ client, queryClient, guard });
      return;
    }
    reportSessionError(error, queryClient);
    await leaveKnown(queryClient);
  }
}

/** Drain any pre-write verification, then obtain a fresh post-write candidate. */
async function refreshAfterCancellation({ client, queryClient, guard }: Context) {
  if (!(await reconcileSession(queryClient, client, "verify")) || guard.isStale()) return;
  await reconcileSession(queryClient, client, "verify");
}
