import type { ApiClient } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { fetchMe, ME_QUERY_KEY } from "./me-query";
import { removeOrganizationQueries } from "./organization-cache";
import { beginExternalChange, endExternalChange } from "./session-revision";
import { subscribeToSessionChanged } from "./session-sync";

/**
 * Another tab changed the shared session (login, sign-out, organization switch). Everything this
 * tab holds may belong to someone else now, so: the revision changes (answers of requests already
 * sent are dropped), requests in flight are cancelled, org-scoped data and placeholders are
 * removed, and org-scoped queries wait until `/me/` says who the user is. Then the route guards
 * run again (the new user may not be allowed on this page).
 */
async function reconcile(queryClient: QueryClient, client: ApiClient, router: AnyRouter) {
  beginExternalChange();
  await queryClient.cancelQueries();
  removeOrganizationQueries(queryClient);
  try {
    await queryClient.query({
      queryKey: ME_QUERY_KEY,
      queryFn: ({ signal }) => fetchMe(client, signal),
      staleTime: 0,
    });
  } catch {
    // A 401 or a lost membership is reported by the caches and handled like anywhere else.
  } finally {
    endExternalChange();
    void router.invalidate();
  }
}

/**
 * Cross-tab session sync (#82): reacts to the other tabs' announcements, and asks `/me/` again
 * whenever this tab becomes visible or focused (cheap), so a tab that missed an announcement
 * still reconciles. `recordIdentity` drops the cache if the answer names someone else.
 */
export function useCrossTabSession(): void {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const router = useRouter();
  useEffect(
    () =>
      subscribeToSessionChanged(() => {
        void reconcile(queryClient, client, router);
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
