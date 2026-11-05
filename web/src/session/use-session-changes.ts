import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { subscribeToIdentityChange } from "./identity";
import { restartOrgScoped } from "./org-scoped-query";
import { subscribeToMembershipLost } from "./session-events";
import { forgetSlugOfLostMembership } from "./session-controller";
import { reconcileSession } from "./session-reconcile";
import { currentRevision, subscribeToRevision } from "./session-revision";

/**
 * Things that change who the user is or where they work in the middle of a session:
 * - a `403 no_active_membership`: the organization (or the membership) is gone. Forget the chosen
 *   organization and everything cached for it, mark `/me/` stale and run the route guards again;
 * - a new `/me/` for another user or organization (the cache was already emptied): run the guards
 *   again so the current page is reconsidered.
 */
export function useSessionChanges(): void {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const router = useRouter();
  useEffect(
    () =>
      subscribeToMembershipLost(() => {
        // The organization is gone: forget it and reconcile, so `/me/` says where the user is now.
        forgetSlugOfLostMembership();
        void reconcileSession(queryClient, client).then((isKnown) => {
          if (isKnown) return router.invalidate();
        });
      }),
    [queryClient, client, router],
  );
  useEffect(
    () =>
      subscribeToIdentityChange(() => {
        void router.invalidate();
      }),
    [router],
  );
  useEffect(() => {
    let seen = currentRevision();
    return subscribeToRevision(() => {
      if (currentRevision() === seen) return;
      seen = currentRevision();
      void restartOrgScoped(queryClient);
    });
  }, [queryClient]);
}
