import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { finishAuthOperation, startAuthOperation, usePendingAuthOperation } from "./auth-operation";
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
 * Signs out: ends the server session and leaves it. It never overlaps a sign-in (`isBusy` is
 * also true while one is running) and always releases its lock.
 */
export function useSignOut() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pending = usePendingAuthOperation();
  const [failure, setFailure] = useState<ServiceFailure | undefined>();
  async function signOut(): Promise<void> {
    const operation = startAuthOperation("logout");
    if (operation === undefined) return;
    try {
      setFailure(undefined);
      const outcome = await requestLogout(client, operation.signal);
      if (outcome.ok) await leaveSession(queryClient, router);
      else setFailure(outcome.failure);
    } finally {
      finishAuthOperation(operation.token);
    }
  }
  return { signOut, isBusy: pending !== null, failure };
}
