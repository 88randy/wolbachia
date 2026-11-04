import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { runAuthOperation } from "./auth-operation";
import { forgetIdentity } from "./identity";
import { clearOrganizationSlug } from "./organization-slug";
import { requestLogout } from "./request-logout";
import { endSessionExpiry } from "./session-events";

/**
 * The server ended the session: forget the organization, go to sign-in, and empty the cache even
 * if the navigation fails. The cache is emptied after the navigation, so the screens still
 * mounted do not refetch into a 401 on the way out.
 */
async function leaveSession(queryClient: QueryClient, router: AnyRouter): Promise<void> {
  clearOrganizationSlug();
  endSessionExpiry();
  try {
    await router.navigate({ to: "/login" });
  } catch (error) {
    console.error("Could not open the sign-in page after signing out", error);
  } finally {
    queryClient.clear();
    forgetIdentity(queryClient);
  }
}

/**
 * Signs out: ends the server session and leaves it. It is queued with the other auth operations
 * and is NEVER abandoned: it completes even if the screen that started it is gone. `isBusy` is
 * true from the click until it settles.
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
    const { result } = runAuthOperation("logout", async ({ signal }) => {
      const outcome = await requestLogout(client, signal);
      if (outcome.ok) await leaveSession(queryClient, router);
      return outcome;
    });
    const outcome = await result;
    if (outcome && !outcome.ok) setFailure(outcome.failure);
    setIsBusy(false);
  }
  return { signOut, isBusy, failure };
}
