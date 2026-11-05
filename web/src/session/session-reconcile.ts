import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { fetchMe, ME_QUERY_KEY } from "./me-query";
import { removeOrganizationQueries } from "./organization-cache";
import { endSessionExpiry } from "./session-events";
import {
  beginExternalChange,
  clearSessionUnknown,
  endExternalChange,
  markSessionUnknown,
} from "./session-revision";

/**
 * The cookie is the truth (#82). Whenever what this tab believes may differ from what the server
 * holds (another tab announced a session change, or a login completed on the server while the tab
 * had meanwhile recorded another identity), ask `/me/` and apply ITS identity, whatever the tab
 * thought:
 *
 * - the session revision changes, so answers of requests already sent are dropped;
 * - requests in flight are cancelled and org-scoped data and placeholders are removed, and
 *   org-scoped queries wait until `/me/` answers;
 * - `/me/` is stored (`recordIdentity` drops the cache if it names someone else) and, because it
 *   answered, the session exists: the expiry dialog closes. If it fails with a 401 the caches
 *   report it and the dialog opens, which is the truth too.
 *
 * Resolves `true` when `/me/` answered and `false` when the identity is unknown (callers re-run
 * the route guards only on `true`: they would fail on the same `/me/`). Never rejects. If `/me/` fails the tab enters the `unknown` state (see `markSessionUnknown`) and
 * shows the blocking "session check failed" state with a retry; it does not go back to the old
 * identity. Receivers of another tab's announcement call this WITHOUT broadcasting again.
 */
export async function reconcileSession(
  queryClient: QueryClient,
  client: ApiClient,
): Promise<boolean> {
  beginExternalChange();
  await queryClient.cancelQueries();
  removeOrganizationQueries(queryClient);
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
    // failure, the identity is UNKNOWN: never fall back to the one held before.
    markSessionUnknown();
    return false;
  } finally {
    endExternalChange();
  }
}
