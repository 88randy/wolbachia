import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { ME_QUERY_KEY } from "./me-query";
import { clearOrganizationSlug } from "./organization-slug";
import { subscribeToMembershipLost } from "./session-events";

/**
 * A `403 no_active_membership` in the middle of a session: the organization (or the membership)
 * is gone. Forget the chosen organization and everything cached for it, mark `/me/` stale and
 * run the route guards again: they send the user to choose an organization or to sign in.
 */
export function useMembershipLost(): void {
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(
    () =>
      subscribeToMembershipLost(() => {
        clearOrganizationSlug();
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] });
        void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
        void router.invalidate();
      }),
    [queryClient, router],
  );
}
