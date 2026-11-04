import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { subscribeToIdentityChange } from "./identity";
import { ME_QUERY_KEY } from "./me-query";
import { removeOrganizationQueries } from "./organization-cache";
import { clearOrganizationSlug } from "./organization-slug";
import { subscribeToMembershipLost } from "./session-events";

/**
 * Things that change who the user is or where they work in the middle of a session:
 * - a `403 no_active_membership`: the organization (or the membership) is gone. Forget the chosen
 *   organization and everything cached for it, mark `/me/` stale and run the route guards again;
 * - a new `/me/` for another user or organization (the cache was already emptied): run the guards
 *   again so the current page is reconsidered.
 */
export function useMembershipLost(): void {
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(
    () =>
      subscribeToMembershipLost(() => {
        clearOrganizationSlug();
        removeOrganizationQueries(queryClient);
        void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
        void router.invalidate();
      }),
    [queryClient, router],
  );
  useEffect(
    () =>
      subscribeToIdentityChange(() => {
        void router.invalidate();
      }),
    [router],
  );
}
