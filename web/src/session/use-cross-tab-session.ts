import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { ME_QUERY_KEY } from "./me-query";
import { reconcileSession } from "./session-reconcile";
import { subscribeToSessionChanged } from "./session-sync";

/**
 * Cross-tab session sync (#82): when another tab announces a session change, reconcile with
 * `/me/` (`reconcileSession`) and run the route guards again (the new user may not be allowed on
 * this page). Also asks `/me/` whenever this tab becomes visible or focused (cheap), so a tab that
 * missed an announcement still reconciles; `recordIdentity` drops the cache if the answer names
 * someone else.
 */
export function useCrossTabSession(): void {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const router = useRouter();
  useEffect(
    () =>
      subscribeToSessionChanged(() => {
        void reconcileSession(queryClient, client).then((isKnown) => {
          if (isKnown) return router.invalidate();
        });
      }),
    [queryClient, client, router],
  );
  useEffect(() => {
    const refresh = (): void => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [queryClient]);
}
