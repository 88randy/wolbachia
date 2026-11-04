import { isErrorEnvelope, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { NO_ACTIVE_MEMBERSHIP } from "../api/error-codes";
import { clearOrganizationSlug, getOrganizationSlug } from "./organization-slug";

export const ME_QUERY_KEY = ["me"] as const;

/**
 * How long `/me/` counts as fresh. After that, a window focus or a remount refetches it, so a
 * permission changed by an administrator reaches the navigation without a new sign-in.
 */
export const ME_STALE_TIME_MS = 60_000;

/**
 * `GET /me/`. A stored organization slug that no longer matches an active membership is
 * answered with `403 no_active_membership`: the slug is forgotten and the call retried once
 * without the header, so the user lands on organization selection instead of a dead end.
 */
export async function fetchMe(client: ApiClient): Promise<Me> {
  const first = await client.GET("/api/v1/me/");
  const isStaleSlug =
    first.response.status === 403 &&
    isErrorEnvelope(first.error) &&
    first.error.code === NO_ACTIVE_MEMBERSHIP &&
    getOrganizationSlug() !== undefined;
  if (!isStaleSlug) return unwrap(first);
  clearOrganizationSlug();
  return unwrap(await client.GET("/api/v1/me/"));
}

/**
 * `/me/` for a route guard: the cached answer while it is fresh, otherwise a new request (so a
 * navigation after a minute also refreshes the permissions). Rejects with the `ApiError`.
 */
export function loadMe(queryClient: QueryClient, client: ApiClient): Promise<Me> {
  return queryClient.query({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetchMe(client),
    staleTime: ME_STALE_TIME_MS,
  });
}

export function meQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetchMe(client),
    staleTime: ME_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}
