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
import type { Me } from "./me";
import { reauthSchema } from "./reauth-schema";
import type { ReauthValues } from "./reauth-schema";
import { begin, commitKnown, isLatest, noteStaleLogin } from "./session-controller";
import { reconcileAndRevalidate } from "./session-reconcile";
import { currentRevision } from "./session-revision";
import { useMe } from "./use-me";

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
 * Queues the login. The token is the epoch of the session this form was shown for: if a sign-out
 * or another login changes it while this waits in the queue, nothing is sent. Once SENT, a login
 * the server accepted is never dropped: its body is a candidate for `commitKnown`; if the token
 * went stale the body is not published, the confirmed login is announced and the tab reconciles
 * with `/me/` (`state.diverged`): the cookie is the truth (#82).
 */
function startReauth({ client, queryClient, username, password }: ReauthRequest) {
  const shownFor = currentRevision();
  const state = { started: false, published: false };
  const run = runAuthOperation("login", async ({ signal, isCurrent, commit }) => {
    if (shownFor !== currentRevision() || !isCurrent()) return undefined;
    // The request can change the cookie: leave `known` BEFORE it is sent.
    const token = begin(queryClient, "leave");
    state.started = true;
    const outcome = await requestLogin(client, { username, password }, signal);
    const isStale = !isLatest(token) || !isCurrent();
    if (outcome.ok) {
      commit(); // the dialog unmounting because of the commit must not abandon it
      const { me, attestation } = outcome;
      const isPublished = commitKnown(queryClient, token, { me, attestation, ...PUBLISH_LOGIN });
      if (!isPublished) noteStaleLogin();
      state.published = isPublished;
    }
    return outcome.ok || !isStale ? outcome : undefined;
  });
  return { run, state };
}

const PUBLISH_LOGIN = { announce: true, bumpEpoch: true };

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
    if (!state.published) {
      // Not published (wrong password, abandoned, superseded, stale body): if the request went
      // out the tab had left `known`, so it asks `/me/`; the cookie is the truth.
      if (outcome?.ok === false && run.isCurrent()) setFailure(outcome.failure);
      if (state.started) await reconcileAndRevalidate(queryClient, client, router);
    } else if (outcome !== undefined && run.isCurrent()) {
      await settleReauth(outcome, { queryClient, router, setFailure });
    }
  });
  return { form, username: user.username, failure, alertRef, submit };
}
