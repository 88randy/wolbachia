import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { clearOrganizationSlug } from "./organization-slug";
import { requestLogout } from "./request-logout";

/**
 * Signs out: ends the server session, forgets the chosen organization, empties the query cache
 * (nothing of this user may stay in memory) and goes to sign-in. The cache is emptied after the
 * navigation, so the screens still mounted do not refetch into a 401 on the way out.
 */
export function useSignOut() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<ServiceFailure | undefined>();
  async function signOut(): Promise<void> {
    setIsBusy(true);
    setFailure(undefined);
    const outcome = await requestLogout(client);
    if (outcome.ok) {
      clearOrganizationSlug();
      await router.navigate({ to: "/login" });
      queryClient.clear();
    } else {
      setFailure(outcome.failure);
      setIsBusy(false);
    }
  }
  return { signOut, isBusy, failure };
}
