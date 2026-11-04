import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { finishAuthOperation, startAuthOperation, usePendingAuthOperation } from "./auth-operation";
import { forgetIdentity } from "./identity";
import { clearOrganizationSlug } from "./organization-slug";
import { requestLogout } from "./request-logout";
import { endSessionExpiry } from "./session-events";

/**
 * Signs out: ends the server session, forgets the chosen organization, empties the query cache
 * (nothing of this user may stay in memory) and goes to sign-in. The cache is emptied after the
 * navigation, so the screens still mounted do not refetch into a 401 on the way out. It never
 * overlaps a re-authentication (`isBusy` is also true while that one is running).
 */
export function useSignOut() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pending = usePendingAuthOperation();
  const [failure, setFailure] = useState<ServiceFailure | undefined>();
  async function signOut(): Promise<void> {
    const token = startAuthOperation("logout");
    if (token === undefined) return;
    setFailure(undefined);
    const outcome = await requestLogout(client);
    if (outcome.ok) {
      clearOrganizationSlug();
      endSessionExpiry();
      await router.navigate({ to: "/login" });
      queryClient.clear();
      forgetIdentity(queryClient);
    } else {
      setFailure(outcome.failure);
    }
    finishAuthOperation(token);
  }
  return { signOut, isBusy: pending !== null, failure };
}
