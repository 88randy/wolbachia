import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { runAuthOperation } from "./auth-operation";
import { ME_QUERY_KEY } from "./me-query";
import { forgetIdentity } from "./identity";
import { clearOrganizationSlug } from "./organization-slug";
import { requestLogout } from "./request-logout";
import { endSessionExpiry } from "./session-events";

/**
 * Signs out: ends the server session and leaves it. It is queued with the other auth operations
 * and is NEVER abandoned: it completes even if the screen that started it is gone. The queued
 * task only does the request and forgets the organization; going to sign-in and emptying the cache
 * follow outside the queue (the cache only if a sign-in queued behind it did not store a new
 * session meanwhile), so a hung navigation can never block the operations behind it. The cache is
 * emptied after the navigation so the screens still mounted do not refetch into a 401. `isBusy`
 * is true from the click until everything settles.
 */
export function useSignOut() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<ServiceFailure | undefined>();
  async function signOut(): Promise<void> {
    if (isBusy) return;
    setIsBusy(true);
    setFailure(undefined);
    let endedAt = 0;
    const run = runAuthOperation("logout", async ({ signal }) => {
      const outcome = await requestLogout(client, signal);
      if (outcome.ok) {
        clearOrganizationSlug();
        endSessionExpiry();
        endedAt = Date.now();
      }
      return outcome;
    });
    const outcome = await run.result;
    if (outcome?.ok) await leaveSession(queryClient, router, endedAt);
    else if (outcome) setFailure(outcome.failure);
    setIsBusy(false);
  }
  return { signOut, isBusy, failure };
}

async function leaveSession(
  queryClient: QueryClient,
  router: AnyRouter,
  endedAt: number,
): Promise<void> {
  try {
    await router.navigate({ to: "/login" });
  } catch (error) {
    console.error("Could not open the sign-in page after signing out", error);
  } finally {
    // A sign-in queued behind this sign-out may have stored a new session meanwhile: keep it.
    if ((queryClient.getQueryState(ME_QUERY_KEY)?.dataUpdatedAt ?? 0) <= endedAt) {
      queryClient.clear();
      forgetIdentity(queryClient);
    }
  }
}
