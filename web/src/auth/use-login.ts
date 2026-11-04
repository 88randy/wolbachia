import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useApiClient } from "../api/ApiClientProvider";
import { safeRedirect } from "../router/safe-redirect";
import { ME_QUERY_KEY } from "../session/me-query";
import { endSessionExpiry } from "../session/session-events";
import type { LoginFailure } from "./login-failure";
import { requestLogin } from "./request-login";
import type { Credentials } from "./request-login";

/**
 * Signs in and, on success, stores `me`, clears whatever a previous user left in the cache and
 * goes where the user was headed: the (validated) `redirect` target, or the organization chooser
 * first when they belong to several organizations. Returns the failure, or undefined on success.
 */
export function useLogin(requestedTarget: string | undefined) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  return async (credentials: Credentials): Promise<LoginFailure | undefined> => {
    const outcome = await requestLogin(client, credentials);
    if (!outcome.ok) return outcome.failure;
    queryClient.clear();
    queryClient.setQueryData(ME_QUERY_KEY, outcome.me);
    endSessionExpiry();
    const target = safeRedirect(requestedTarget);
    if (outcome.me.organization === null) {
      const search = target === "/" ? {} : { redirect: target };
      await router.navigate({ to: "/select-organization", search });
    } else {
      router.history.push(target);
    }
    return undefined;
  };
}
