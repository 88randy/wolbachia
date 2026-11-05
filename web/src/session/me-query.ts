import { isErrorEnvelope, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { CancelledError, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { NO_ACTIVE_MEMBERSHIP } from "../api/error-codes";
import { IDENTITY_HEADER } from "./attestation";
import { ME_QUERY_KEY } from "./me-key";
import { getOrganizationSlug } from "./organization-slug";
import { begin, commitKnown, forgetRefusedSlug } from "./session-controller";
import type { Token } from "./session-controller";
import { currentRevision } from "./session-revision";

export { ME_QUERY_KEY };

/** How many times a route guard asks `/me/` again after the session changed under it. */
const MAX_REVISION_RETRIES = 3;

/**
 * How long `/me/` counts as fresh. After that, a window focus or a remount refetches it, so a
 * permission changed by an administrator reaches the navigation without a new sign-in.
 */
export const ME_STALE_TIME_MS = 60_000;

interface AskedMe {
  me: Me;
  /** `X-Session-Identity` of the answer: what later responses must carry. */
  attestation: string | null;
}

interface AskOptions {
  signal?: AbortSignal;
  /** Ask as this organization (an organization switch): the slug is committed only with the answer. */
  slug?: string;
}

async function requestMe(client: ApiClient, { signal, slug }: AskOptions): Promise<AskedMe> {
  const init = {
    ...(signal ? { signal } : {}),
    ...(slug === undefined ? {} : { params: { header: { "X-Organization": slug } } }),
  };
  const stored = getOrganizationSlug();
  const first = await client.GET("/api/v1/me/", init);
  const isRefused =
    first.response.status === 403 &&
    isErrorEnvelope(first.error) &&
    first.error.code === NO_ACTIVE_MEMBERSHIP;
  // A stored slug the server refuses (a previous session of someone else) is forgotten and the
  // call retried without it, so the user lands on organization selection instead of a dead end.
  // Only a slug THIS request was sent with, and never a slug the caller chose on purpose.
  if (
    !isRefused ||
    slug !== undefined ||
    stored === undefined ||
    getOrganizationSlug() !== stored
  ) {
    return askedFrom(first);
  }
  forgetRefusedSlug(stored);
  return askedFrom(await client.GET("/api/v1/me/", init));
}

function askedFrom(result: { data?: Me; error?: unknown; response: Response }): AskedMe {
  const me = unwrap(result);
  return { me, attestation: result.response.headers.get(IDENTITY_HEADER) };
}

interface MeDeps {
  client: ApiClient;
  queryClient: QueryClient;
  signal?: AbortSignal;
}

interface MeRequest {
  /** The operation's token; a plain read of `/me/` begins its own. */
  token?: Token;
  slug?: string;
  announce?: boolean;
}

/**
 * `GET /me/` as a candidate: the answer is published (state, slug, identity, attestation and the
 * `/me/` cache entry) only through `commitKnown`, and only if the token is still the epoch. A
 * stale answer is discarded (`CancelledError`, TanStack reverts): nothing is stored, nothing is
 * recorded. This is the ONLY path by which `/me/` data reaches the cache.
 */
export async function fetchMeCommitted(deps: MeDeps, request: MeRequest = {}): Promise<Me> {
  const { client, queryClient, signal } = deps;
  const isPassive = request.token === undefined;
  const token = request.token ?? begin(queryClient, "passive");
  const asked = await requestMe(client, {
    ...(signal ? { signal } : {}),
    ...(request.slug === undefined ? {} : { slug: request.slug }),
  });
  const candidate = { me: asked.me, attestation: asked.attestation, slug: request.slug };
  const options = { announce: request.announce === true, passive: isPassive };
  if (!commitKnown(queryClient, token, { ...candidate, ...options })) {
    throw new CancelledError({ revert: true });
  }
  return asked.me;
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
      .query(meQueryOptions(client))
      .catch((error: unknown) => ({ error }));
    if (!("error" in result)) return result;
    // The session REVISION changed while this asked (another tab signed in): that answer was
    // discarded (`commitKnown`). Ask again for the new epoch instead of failing the route. A
    // cancel without a revision change (an organization switch) is not retried.
    const isStale = result.error instanceof CancelledError && currentRevision() !== started;
    if (!isStale || attempt >= MAX_REVISION_RETRIES) throw result.error;
    attempt += 1;
  }
}

export function meQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal, client: queryClient }) => fetchMeCommitted({ client, queryClient, signal }),
    staleTime: ME_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}
