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
  try {
    await fetchMeCommitted({ client, queryClient, signal: guard.signal });
  } catch (error) {
    if (guard.isStale()) return;
    reportSessionError(error, queryClient);
    await leaveKnown(queryClient);
  }
}
