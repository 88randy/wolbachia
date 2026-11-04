import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { fetchMe, ME_QUERY_KEY } from "./me-query";
import { setOrganizationSlug } from "./organization-slug";

/**
 * Makes `slug` the active organization: stores it (it travels as `X-Organization` from now on),
 * drops every cached answer of the previous organization and asks `/me/` again, which is the
 * server's answer about what the user can do there. Rejects with the `ApiError` of `/me/`.
 */
export async function switchOrganization(
  queryClient: QueryClient,
  client: ApiClient,
  slug: string,
): Promise<Me> {
  setOrganizationSlug(slug);
  // `/me/` itself stays in the cache so mounted screens keep their observer; it is refreshed next.
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
  return queryClient.query({
    queryKey: ME_QUERY_KEY,
    queryFn: () => fetchMe(client),
    staleTime: 0,
  });
}
