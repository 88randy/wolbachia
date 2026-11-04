import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { RegisteredRouter } from "@tanstack/react-router";

import { useApiClient } from "../api/ApiClientProvider";
import { safeRedirect } from "../router/safe-redirect";
import {
  finishAuthOperation,
  isCurrentOperation,
  startAuthOperation,
  useAbandonOnUnmount,
} from "../session/auth-operation";
import { forgetIdentity, recordIdentity } from "../session/identity";
import type { Me } from "../session/me";
import { ME_QUERY_KEY } from "../session/me-query";
import { endSessionExpiry } from "../session/session-events";
import type { LoginFailure } from "./login-failure";
import { requestLogin } from "./request-login";
import type { Credentials } from "./request-login";

/** The server accepted the credentials: replace whatever a previous user left and move on. */
async function enterSession(
  me: Me,
  requestedTarget: string | undefined,
  { queryClient, router }: { queryClient: QueryClient; router: RegisteredRouter },
): Promise<void> {
  queryClient.clear();
  forgetIdentity(queryClient);
  recordIdentity(queryClient, me);
  queryClient.setQueryData(ME_QUERY_KEY, me);
  endSessionExpiry();
  const target = safeRedirect(requestedTarget);
  if (me.organization === null) {
    const search = target === "/" ? {} : { redirect: target };
    await router.navigate({ to: "/select-organization", search });
  } else {
    router.history.push(target);
  }
}

/**
 * Signs in and, on success, stores `me`, clears whatever a previous user left in the cache and
 * goes where the user was headed: the (validated) `redirect` target, or the organization chooser
 * first when they belong to several organizations. Returns the failure, or undefined on success.
 * It shares the sign-in/sign-out lock; leaving the page abandons (aborts) a pending request.
 */
export function useLogin(requestedTarget: string | undefined) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const tokenRef = useAbandonOnUnmount();
  return async (credentials: Credentials): Promise<LoginFailure | undefined> => {
    const operation = startAuthOperation("login");
    if (operation === undefined) return { kind: "generic" };
    tokenRef.current = operation.token;
    try {
      const outcome = await requestLogin(client, credentials, operation.signal);
      if (!isCurrentOperation(operation.token)) return undefined;
      if (!outcome.ok) return outcome.failure;
      await enterSession(outcome.me, requestedTarget, { queryClient, router });
      return undefined;
    } finally {
      finishAuthOperation(operation.token);
    }
  };
}
