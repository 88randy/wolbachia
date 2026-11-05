import { isErrorEnvelope, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { CancelledError, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { NO_ACTIVE_MEMBERSHIP } from "../api/error-codes";
import { IDENTITY_HEADER, setExpectedAttestation } from "./attestation";
import { currentRevision, recoverSession } from "./session-revision";
import { clearOrganizationSlug, getOrganizationSlug } from "./organization-slug";

export const ME_QUERY_KEY = ["me"] as const;

/** How many times a route guard asks `/me/` again after the session changed under it. */
const MAX_REVISION_RETRIES = 3;

/**
 * How long `/me/` counts as fresh. After that, a window focus or a remount refetches it, so a
 * permission changed by an administrator reaches the navigation without a new sign-in.
 */
export const ME_STALE_TIME_MS = 60_000;

/**
 * `GET /me/`. A stored organization slug that no longer matches an active membership is
 * answered with `403 no_active_membership`: the slug is forgotten and the call retried once
 * without the header, so the user lands on organization selection instead of a dead end.
 *
 * SIDE EFFECT on module state: a valid answer to a request that started in the current session
 * revision calls `recoverSession()`. If the page was signed out, another tab signed in again, so
 * real 401s count as expiry again. An answer to a request that started before a sign-out carries
 * an older revision and changes nothing.
 */
export function fetchMe(client: ApiClient, signal?: AbortSignal): Promise<Me> {
  return fetchMeForRevision(client, currentRevision(), signal);
}

/**
 * `/me/` is accepted only for the revision that asked for it (#82): this is the ONLY path by which
 * `/me/` data reaches the cache (and so `recordIdentity`). The answer is discarded, with no
 * `setQueryData`, no `recordIdentity` and no state change, when the session revision changed
 * since `revision` was captured (a login, a sign-out, another identity, another tab) or the
 * request was aborted (a newer run superseded it).
 */
export async function fetchMeForRevision(
  client: ApiClient,
  revision: number,
  signal?: AbortSignal,
): Promise<Me> {
  const { me, attestation } = await requestMe(client, signal);
  if (revision !== currentRevision() || signal?.aborted === true) {
    throw new CancelledError({ revert: true });
  }
  // Accepted: this is the identity the server attests for the session from now on.
  setExpectedAttestation(attestation);
  recoverSession();
  return me;
}

interface AskedMe {
  me: Me;
  /** `X-Session-Identity` of the answer: what later responses must carry. */
  attestation: string | null;
}

async function requestMe(client: ApiClient, signal?: AbortSignal): Promise<AskedMe> {
  const options = signal ? { signal } : {};
  const slug = getOrganizationSlug();
  const first = await client.GET("/api/v1/me/", options);
  const isRefused =
    first.response.status === 403 &&
    isErrorEnvelope(first.error) &&
    first.error.code === NO_ACTIVE_MEMBERSHIP;
  // Only recover from the slug THIS request was sent with: if the user chose another one while it
  // was in flight, a late refusal is about the old organization and must not touch the new slug.
  if (!isRefused || slug === undefined || getOrganizationSlug() !== slug) return askedFrom(first);
  clearOrganizationSlug();
  return askedFrom(await client.GET("/api/v1/me/", options));
}

function askedFrom(result: { data?: Me; error?: unknown; response: Response }): AskedMe {
  const me = unwrap(result);
  return { me, attestation: result.response.headers.get(IDENTITY_HEADER) };
}

/**
 * `/me/` for a route guard: the cached answer while it is fresh, otherwise a new request (so a
 * navigation after a minute also refreshes the permissions). Rejects with the `ApiError`.
 */
export async function loadMe(queryClient: QueryClient, client: ApiClient): Promise<Me> {
  let attempt = 1;
  for (;;) {
    const started = currentRevision();
    const result = await queryClient
      .query({
        queryKey: ME_QUERY_KEY,
        queryFn: ({ signal }) => fetchMe(client, signal),
        staleTime: ME_STALE_TIME_MS,
      })
      .catch((error: unknown) => ({ error }));
    if (!("error" in result)) return result;
    // The session REVISION changed while this asked (another tab signed in): that answer was
    // discarded (`fetchMeForRevision`). Ask again for the new revision instead of failing the
    // route. A cancel without a revision change (an organization switch) is not retried.
    const isStale = result.error instanceof CancelledError && currentRevision() !== started;
    if (!isStale || attempt >= MAX_REVISION_RETRIES) throw result.error;
    attempt += 1;
  }
}

export function meQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) => fetchMe(client, signal),
    staleTime: ME_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}
