import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { RegisteredRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { ApiClient } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import type { LoginFailure } from "../auth/login-failure";
import { requestLogin } from "../auth/request-login";
import type { LoginOutcome } from "../auth/request-login";
import { useFocusAlert } from "../forms/use-focus-alert";
import { runAuthOperation, useAbandonOnUnmount } from "./auth-operation";
import { recordIdentity } from "./identity";
import type { Me } from "./me";
import { ME_QUERY_KEY } from "./me-query";
import { reauthSchema } from "./reauth-schema";
import type { ReauthValues } from "./reauth-schema";
import { endSessionExpiry } from "./session-events";
import { reconcileSession } from "./session-reconcile";
import { acceptSession, currentRevision } from "./session-revision";
import { useMe } from "./use-me";

/** The session is back: store `/me/` and drop another user's or organization's cache (synchronous). */
function restoreSession(me: Me, queryClient: QueryClient, commit: () => void): void {
  commit(); // the dialog unmounting because of this very update must not abandon it
  recordIdentity(queryClient, me);
  queryClient.setQueryData(ME_QUERY_KEY, me);
  endSessionExpiry();
  acceptSession();
}

/** After the queue: navigating can wait on the network, so it comes last. */
async function goToChooserIfNeeded(me: Me, router: RegisteredRouter): Promise<void> {
  if (me.organization === null) await router.navigate({ to: "/select-organization" });
}

interface SettleContext {
  queryClient: QueryClient;
  router: RegisteredRouter;
  setFailure: (failure: LoginFailure) => void;
}

/** After the queue: show the failure, or refetch and, if needed, go to the organization chooser. */
async function settleReauth(
  outcome: LoginOutcome,
  { queryClient, router, setFailure }: SettleContext,
): Promise<void> {
  if (!outcome.ok) {
    setFailure(outcome.failure);
    return;
  }
  void queryClient.invalidateQueries();
  await goToChooserIfNeeded(outcome.me, router);
}

interface ReauthRequest {
  client: ApiClient;
  queryClient: QueryClient;
  username: string;
  password: string;
}

/**
 * Queues the login. The session this form was shown for is captured now: if a sign-out or another
 * login changes it while this waits in the queue, nothing is sent. Once SENT, a login the server
 * accepted is never dropped: the cookie is the truth, so if the tab's session moved meanwhile it
 * must reconcile with `/me/` (`state.diverged`) instead of storing this answer (#82).
 */
function startReauth({ client, queryClient, username, password }: ReauthRequest) {
  const revision = currentRevision();
  const state = { diverged: false };
  const run = runAuthOperation("login", async ({ signal, isCurrent, commit }) => {
    if (revision !== currentRevision() || !isCurrent()) return undefined;
    const outcome = await requestLogin(client, { username, password }, signal);
    const isStale = revision !== currentRevision() || !isCurrent();
    if (outcome.ok && isStale) {
      commit();
      state.diverged = true;
    } else if (outcome.ok) restoreSession(outcome.me, queryClient, commit);
    return outcome.ok || !isStale ? outcome : undefined;
  });
  return { run, state };
}

/**
 * Signs the same user in again without leaving the page: the screens stay mounted, so nothing
 * typed is lost. Afterwards every active query is refetched; the request that failed with the
 * 401 is NOT repeated, the user sends it again. If the session lands in another organization
 * (the stored slug was refused) the old organization's cache is dropped and the guards run again.
 * It is queued with the other auth operations (the task only does the request and synchronous
 * cache updates; refetch and navigation follow outside the queue) and abandoned if the dialog
 * goes away.
 */
export function useReauthenticate() {
  const { user } = useMe();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [failure, setFailure] = useState<LoginFailure | undefined>();
  const alertRef = useFocusAlert(failure);
  const track = useAbandonOnUnmount();
  const form = useForm<ReauthValues>({
    resolver: zodResolver(reauthSchema),
    defaultValues: { password: "" },
  });
  const submit = form.handleSubmit(async ({ password }) => {
    setFailure(undefined);
    const { run, state } = startReauth({ client, queryClient, username: user.username, password });
    track(run);
    const outcome = await run.result;
    if (state.diverged) {
      await reconcileSession(queryClient, client);
      await router.invalidate();
    } else if (outcome !== undefined && run.isCurrent()) {
      await settleReauth(outcome, { queryClient, router, setFailure });
    }
  });
  return { form, username: user.username, failure, alertRef, submit };
}
