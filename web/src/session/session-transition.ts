import type { QueryClient } from "@tanstack/react-query";
import { clearExpectedAttestation } from "./attestation";
import { forgetIdentity } from "./identity";
import { ME_QUERY_KEY } from "./me-query";
import { removeOrganizationQueries } from "./organization-cache";
import { changeIdentity, markSessionUnknown } from "./session-revision";

/**
 * THE one transition out of `known` (#82). Whatever the reason (a failed verification, a 401 of
 * `/me/`, of a resource query or of a mutation), in this order and synchronously:
 *
 * 1. the session revision changes, so every answer of a request already sent is dropped on
 *    arrival;
 * 2. pending queries are cancelled (their signal aborts);
 * 3. org-scoped data and placeholders are removed, so returning to `known` always starts from an
 *    empty org cache and nothing sent with the old cookie can be shown or stored;
 * 4. the recorded identity is forgotten and the cached `/me/` is marked stale;
 * 5. the state becomes `unknown` (org-scoped queries and mutations refuse to start).
 *
 * Callers mark the session expired (401) or show the retry (failed check) AFTER this. Returns the
 * cancellation, which the caller may await.
 */
export function leaveKnown(queryClient: QueryClient): Promise<void> {
  changeIdentity();
  const cancelled = queryClient.cancelQueries();
  removeOrganizationQueries(queryClient);
  // No stale identity survives: the `/me/` held may be another user's (or an expired one's).
  // The `/me/` held is not trusted any more (it may be another user's or an expired one's): the
  // recorded identity is forgotten and the entry is stale until a verified `/me/` replaces it. It
  // is not removed: the shell and the re-authentication dialog still read the user from it.
  forgetIdentity(queryClient);
  clearExpectedAttestation();
  void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY, refetchType: "none" });
  markSessionUnknown();
  return cancelled;
}
