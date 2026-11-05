import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { RegisteredRouter } from "@tanstack/react-router";

import { useApiClient } from "../api/ApiClientProvider";
import { safeRedirect } from "../router/safe-redirect";
import { runAuthOperation, useAbandonOnUnmount } from "../session/auth-operation";
import { forgetIdentity, recordIdentity } from "../session/identity";
import type { Me } from "../session/me";
import { setExpectedAttestation } from "../session/attestation";
import { ME_QUERY_KEY } from "../session/me-query";
import { endSessionExpiry } from "../session/session-events";
import { acceptSession, clearSessionUnknown } from "../session/session-revision";
import type { LoginFailure } from "./login-failure";
import { requestLogin } from "./request-login";
import type { Credentials, LoginSuccess } from "./request-login";

/** The server accepted the credentials: replace whatever a previous user left (synchronous). */
function replaceSession(
  { me, attestation }: LoginSuccess,
  queryClient: QueryClient,
  commit: () => void,
): void {
  commit();
  queryClient.clear();
  forgetIdentity(queryClient);
  setExpectedAttestation(attestation);
  recordIdentity(queryClient, me);
  queryClient.setQueryData(ME_QUERY_KEY, me);
  endSessionExpiry();
  acceptSession();
  clearSessionUnknown(); // a verified identity is stored: the tab knows who it is
}

/** Where the user goes after signing in. Runs outside the auth queue (navigation can wait). */
async function continueAfterLogin(
  me: Me,
  requestedTarget: string | undefined,
  router: RegisteredRouter,
): Promise<void> {
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
 * The queued task only does the request and the synchronous cache update; navigation follows
 * outside the queue. Leaving the page abandons (aborts) it, and its result is ignored if a
 * sign-out was queued after it.
 */
export function useLogin(requestedTarget: string | undefined) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const track = useAbandonOnUnmount();
  return async (credentials: Credentials): Promise<LoginFailure | undefined> => {
    const run = runAuthOperation("login", async ({ signal, isCurrent, commit }) => {
      const outcome = await requestLogin(client, credentials, signal);
      if (!isCurrent()) return undefined;
      if (outcome.ok) replaceSession(outcome, queryClient, commit);
      return outcome;
    });
    track(run);
    const outcome = await run.result;
    if (outcome === undefined) return undefined;
    if (!outcome.ok) return outcome.failure;
    if (run.isCurrent()) await continueAfterLogin(outcome.me, requestedTarget, router);
    return undefined;
  };
}
