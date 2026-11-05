import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { CancelledError } from "@tanstack/react-query";
import { fetchMeForRevision, ME_QUERY_KEY } from "./me-query";
import { removeOrganizationQueries } from "./organization-cache";
import { leaveKnown } from "./session-transition";
import { endSessionExpiry } from "./session-events";
import {
  beginExternalChange,
  beginVerification,
  clearSessionUnknown,
  currentRevision,
  endExternalChange,
  startReconcileRun,
} from "./session-revision";

/** `full`: another tab or this one changed the session. `verify`: only checking (focus). */
export type ReconcileMode = "full" | "verify";

/**
 * The cookie is the truth (#82). EVERY path that can observe a session change goes through here
 * (another tab's broadcast or `storage` event, window focus, the tab becoming visible, the
 * explicit retry, a login that completed on the server while the tab had moved on). The tab is
 * `reconciling` until `/me/` answers; screens stay mounted but are inert (AppShell) and org-scoped
 * requests refuse to start (`isSessionKnown`).
 *
 * - `full`: the session revision changes (answers of requests already sent are dropped), requests
 *   in flight are cancelled and org-scoped data and placeholders are removed;
 * - `verify`: nothing is touched unless `/me/` names another identity (`recordIdentity` then does
 *   all of the above), so coming back to the tab costs one request, not a reload of every screen.
 *
 * `/me/` is then stored and, because it answered, the session exists: the expiry dialog closes and
 * the state is `known`. If it fails the identity is `unknown` (blocking retry), never the one held
 * before. LATEST WINS: starting a run (or a login, or a confirmed sign-out) aborts the one in
 * flight; `/me/` is accepted only for the revision that asked for it (`fetchMeForRevision`), so a
 * superseded run can neither store its answer nor change the state. A `verify` that arrives while
 * another run is in flight shares it. Resolves `true` when `/me/` answered (callers re-run the
 * route guards only then); never rejects. Receivers of another tab's announcement call this
 * WITHOUT broadcasting again.
 */
export function reconcileSession(
  queryClient: QueryClient,
  client: ApiClient,
  mode: ReconcileMode = "full",
): Promise<boolean> {
  if (inFlight !== undefined && mode === "verify") return inFlight;
  const current = run(queryClient, client, mode);
  inFlight = current;
  void current.finally(() => {
    if (inFlight === current) inFlight = undefined;
  });
  return current;
}

let inFlight: Promise<boolean> | undefined;

async function askMe(queryClient: QueryClient, client: ApiClient, run: AbortController) {
  await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY }); // never share an older run's request
  await queryClient.query({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) =>
      fetchMeForRevision(client, currentRevision(), AbortSignal.any([signal, run.signal])),
    staleTime: 0,
  });
}

async function run(queryClient: QueryClient, client: ApiClient, mode: ReconcileMode) {
  if (mode === "full") {
    beginExternalChange();
    await queryClient.cancelQueries();
    removeOrganizationQueries(queryClient);
  } else beginVerification();
  const mine = startReconcileRun();
  try {
    await askMe(queryClient, client, mine);
    if (mine.signal.aborted) return false; // superseded: it never changes the state
    endSessionExpiry();
    clearSessionUnknown();
    return true;
  } catch (error) {
    // Superseded, or the session changed while asking (the answer was discarded): not this run's
    // call. Any other failure (a 401 is also reported by the caches) makes the identity UNKNOWN.
    if (mine.signal.aborted || error instanceof CancelledError) return false;
    await leaveKnown(queryClient);
    return false;
  } finally {
    endExternalChange();
  }
}
