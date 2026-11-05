import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { CancelledError } from "@tanstack/react-query";
import { clearExpectedAttestation } from "./attestation";
import { ME_QUERY_KEY } from "./me-query";
import { removeOrganizationQueries } from "./organization-cache";
import { endSessionExpiry } from "./session-events";
import { askMe } from "./session-reconcile";
import {
  beginExternalChange,
  clearSessionUnknown,
  endExternalChange,
  startReconcileRun,
} from "./session-revision";
import { broadcastSessionChanged } from "./session-sync";
import { leaveKnown } from "./session-transition";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "./organization-slug";

function restoreSlug(previous: string | undefined): void {
  if (previous === undefined) clearOrganizationSlug();
  else setOrganizationSlug(previous);
}

/**
 * Makes `slug` the active organization. Switching is a LEAVE-KNOWN transition (#82): first,
 * synchronously and BEFORE the slug or the expected attestation change, the tab becomes
 * `reconciling`, the revision changes, requests in flight are cancelled and the organization data
 * of the previous organization is removed; so nothing can fetch or store org-scoped data (not even
 * after a Back to a screen of the old organization) until the new identity is verified. Then the
 * slug is stored (it travels as `X-Organization`) and `/me/` is asked: the server's answer about
 * who the user is and what they can do there. The tab is `known` again only after that `/me/` is
 * accepted for this run. If it fails the previous slug is restored and the tab stays `unknown`
 * (blocking retry). Rejects with the error of `/me/`.
 */
export async function switchOrganization(
  queryClient: QueryClient,
  client: ApiClient,
  slug: string,
): Promise<Me> {
  const previous = getOrganizationSlug();
  beginExternalChange();
  clearExpectedAttestation();
  const cancelled = queryClient.cancelQueries();
  removeOrganizationQueries(queryClient);
  const mine = startReconcileRun();
  setOrganizationSlug(slug);
  try {
    await cancelled;
    const isAccepted = await askMe(queryClient, client, mine);
    const me = queryClient.getQueryData<Me>(ME_QUERY_KEY);
    // A newer run or login superseded this switch, or the answer was cancelled and reverted.
    if (mine.signal.aborted || !isAccepted || me === undefined) throw new CancelledError();
    endSessionExpiry();
    clearSessionUnknown();
    broadcastSessionChanged();
    return me;
  } catch (error) {
    restoreSlug(previous);
    if (!mine.signal.aborted) await leaveKnown(queryClient);
    throw error;
  } finally {
    endExternalChange();
  }
}
