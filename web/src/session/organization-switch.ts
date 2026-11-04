import type { ApiClient } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { fetchMe, ME_QUERY_KEY } from "./me-query";
import { broadcastSessionChanged } from "./session-sync";
import { removeOrganizationQueries } from "./organization-cache";
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
 * Makes `slug` the active organization: stores it (it travels as `X-Organization` from now on),
 * drops every cached answer of the previous organization and asks `/me/` again, which is the
 * server's answer about what the user can do there. A `/me/` still in flight for the previous
 * organization is cancelled first (the cache would otherwise hand its answer to this call). If
 * the new `/me/` fails, the previous slug is restored. Rejects with the error of `/me/`.
 */
export async function switchOrganization(
  queryClient: QueryClient,
  client: ApiClient,
  slug: string,
): Promise<Me> {
  const previous = getOrganizationSlug();
  await queryClient.cancelQueries({ queryKey: ME_QUERY_KEY });
  setOrganizationSlug(slug);
  removeOrganizationQueries(queryClient);
  try {
    const me = await queryClient.query({
      queryKey: ME_QUERY_KEY,
      queryFn: ({ signal }) => fetchMe(client, signal),
      staleTime: 0,
    });
    broadcastSessionChanged();
    return me;
  } catch (error) {
    restoreSlug(previous);
    throw error;
  }
}
