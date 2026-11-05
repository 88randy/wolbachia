import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { fetchMe, ME_QUERY_KEY } from "./me-query";
import { removeOrganizationQueries } from "./organization-cache";
import { endSessionExpiry } from "./session-events";
import {
  beginExternalChange,
  beginVerification,
  changeIdentity,
  clearSessionUnknown,
  endExternalChange,
  markSessionUnknown,
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
 * before. Calls are serialized and a `verify` that arrives while another run is in flight shares
 * it. Resolves `true` when `/me/` answered (callers re-run the route guards only then); never
 * rejects. Receivers of another tab's announcement call this WITHOUT broadcasting again.
 */
export function reconcileSession(
  queryClient: QueryClient,
  client: ApiClient,
  mode: ReconcileMode = "full",
): Promise<boolean> {
  if (inFlight !== undefined && mode === "verify") return inFlight;
  const current = (inFlight ?? Promise.resolve(true)).then(() => run(queryClient, client, mode));
  inFlight = current;
  void current.finally(() => {
    if (inFlight === current) inFlight = undefined;
  });
  return current;
}

let inFlight: Promise<boolean> | undefined;

async function run(queryClient: QueryClient, client: ApiClient, mode: ReconcileMode) {
  if (mode === "full") {
    beginExternalChange();
    await queryClient.cancelQueries();
    removeOrganizationQueries(queryClient);
  } else beginVerification();
  try {
    await queryClient.query({
      queryKey: ME_QUERY_KEY,
      queryFn: ({ signal }) => fetchMe(client, signal),
      staleTime: 0,
    });
    endSessionExpiry();
    clearSessionUnknown();
    return true;
  } catch {
    // A 401 or a lost membership is also reported by the caches (like any request). Whatever the
    // failure, the identity is UNKNOWN: never fall back to the one held before. Leaving `known`
    // for any reason first bumps the revision, cancels pending org-scoped queries and removes
    // org-scoped data, so a late answer of the old cookie is dropped and returning to `known`
    // always starts from an empty org cache.
    changeIdentity();
    await queryClient.cancelQueries();
    removeOrganizationQueries(queryClient);
    markSessionUnknown();
    return false;
  } finally {
    endExternalChange();
  }
}
