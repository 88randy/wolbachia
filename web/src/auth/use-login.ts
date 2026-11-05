import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { RegisteredRouter } from "@tanstack/react-router";

import { useApiClient } from "../api/ApiClientProvider";
import { safeRedirect } from "../router/safe-redirect";
import { runAuthOperation, useAbandonOnUnmount } from "../session/auth-operation";
import type { Me } from "../session/me";
import { begin, commitKnown, noteStaleLogin } from "../session/session-controller";
import type { Token } from "../session/session-controller";
import { reconcileSession } from "../session/session-reconcile";
import type { LoginFailure } from "./login-failure";
import { requestLogin } from "./request-login";
import type { Credentials, LoginSuccess } from "./request-login";

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
    const state = { diverged: false };
    const run = runAuthOperation("login", async ({ signal, isCurrent, commit }) => {
      // The token is taken when the queued task STARTS: a sign-out queued before it has finished.
      const token = begin(queryClient, "passive");
      const outcome = await requestLogin(client, credentials, signal);
      if (!isCurrent()) return undefined;
      if (outcome.ok) {
        commit();
        state.diverged = !publishLogin(outcome, queryClient, token);
      }
      return outcome;
    });
    track(run);
    const outcome = await run.result;
    if (state.diverged) {
      // The session moved while this login was in flight: its body is not published; the cookie
      // is the truth, so `/me/` says who it belongs to.
      if (await reconcileSession(queryClient, client)) await router.invalidate();
      return undefined;
    }
    if (outcome === undefined) return undefined;
    if (!outcome.ok) return outcome.failure;
    if (run.isCurrent()) await continueAfterLogin(outcome.me, requestedTarget, router);
    return undefined;
  };
}

/**
 * The server accepted the credentials: the body is a candidate, published only while the token is
 * still the epoch (it replaces whatever a previous user left and tells the other tabs). A stale
 * body is dropped, but the confirmed login still changed the cookie. Returns whether it was published.
 */
function publishLogin(
  { me, attestation }: LoginSuccess,
  queryClient: QueryClient,
  token: Token,
): boolean {
  const options = { replace: true, announce: true, bumpEpoch: true };
  if (commitKnown(queryClient, token, { me, attestation, ...options })) return true;
  noteStaleLogin();
  return false;
}
