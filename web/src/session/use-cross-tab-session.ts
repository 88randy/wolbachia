import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { reconcileSession } from "./session-reconcile";
import { subscribeToSessionChanged } from "./session-sync";

/**
 * Cross-tab session sync (#82): when another tab announces a session change, reconcile with
 * `/me/` (`reconcileSession`) and run the route guards again (the new user may not be allowed on
 * this page). Also verifies `/me/` whenever this tab becomes visible or focused, so a tab that
 * missed an announcement still reconciles.
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
    // A tab that missed the announcement still reconciles: asking `/me/` is cheap, and the tab is
    // blocked until it answers. Identity changes re-run the guards through `recordIdentity`.
    const refresh = (): void => {
      if (document.visibilityState === "visible") {
        void reconcileSession(queryClient, client, "verify");
      }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [queryClient, client]);
}
