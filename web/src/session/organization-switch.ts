import type { ApiClient } from "@wolbachia/api-client";
import { CancelledError } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Me } from "./me";
import { ME_QUERY_KEY } from "./me-key";
import { fetchMeCommitted } from "./me-query";
import { begin, failIfCurrent } from "./session-controller";

/**
 * Makes `slug` the active organization. Switching is a LEAVE-KNOWN operation (#82): it `begin`s
 * first, synchronously, so the tab is `reconciling`, the epoch changed and the organization data
 * of the previous organization is gone before anything else; nothing org-scoped can fetch or store
 * (not even after a Back to a screen of the old organization) until the new identity is verified.
 * Then `/me/` is asked AS that organization (the slug travels with the call; it is stored only by
 * the commit of the answer, together with the identity and the attestation) and the other tabs are
 * told. Nothing is ever restored: if the `/me/` fails, a current switch makes the tab `unknown`
 * (it reconciles) and a superseded one does nothing. Rejects with the error of `/me/`.
 */
export async function switchOrganization(
  queryClient: QueryClient,
  client: ApiClient,
  slug: string,
): Promise<Me> {
  const token = begin(queryClient, "leave");
  let committed: Me | undefined;
  try {
    await queryClient.query({
      queryKey: ME_QUERY_KEY,
      queryFn: async ({ signal, client: cache }) => {
        committed = await fetchMeCommitted(
          { client, queryClient: cache, signal },
          { token, slug, announce: true },
        );
        return committed;
      },
      staleTime: 0,
    });
    // `committed` comes from the answer itself, never from reading the cache afterwards.
    if (committed === undefined) throw new CancelledError();
    return committed;
  } catch (error) {
    await failIfCurrent(queryClient, token);
    throw error;
  }
}
