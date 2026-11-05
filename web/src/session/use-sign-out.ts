import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { runAuthOperation } from "./auth-operation";
import { requestLogout } from "./request-logout";
import { begin, clearAfterSignOut, commitSignedOut } from "./session-controller";
import { reconcileAndRevalidate } from "./session-reconcile";

/**
 * Signs out: ends the server session and leaves it. It is queued with the other auth operations
 * and is NEVER abandoned: it completes even if the screen that started it is gone. The queued
 * task only does the request; once the server confirms it, synchronously: the session revision
 * changes, requests in flight of the closed session are cancelled (their answers are discarded)
 * and the organization is forgotten (`commitSignedOut`, only for a current token). Going to sign-in and emptying the cache follow outside the
 * queue, so a hung navigation can never block the operations behind it; the cache is emptied only
 * if the revision is still the one this sign-out produced (a sign-in queued behind it that was
 * accepted meanwhile keeps its session). `isBusy` is true from the click until everything settles.
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
    const run = runAuthOperation("logout", async ({ signal }) => {
      // The request changes the cookie: leave `known` BEFORE it is sent. The token is taken when
      // the queued task STARTS: a login queued before it has finished.
      const token = begin(queryClient, "leave");
      const outcome = await requestLogout(client, signal);
      if (!outcome.ok) return { ok: false as const, failure: outcome.failure };
      return { ok: true as const, epoch: commitSignedOut(queryClient, token) };
    });
    const done = await run.result;
    if (done?.ok && done.epoch === undefined) {
      // The session moved while the sign-out was in flight: nothing is published; the cookie is
      // the truth, so ask `/me/` who it belongs to.
      await reconcileAndRevalidate(queryClient, client, router);
    } else if (done?.ok && done.epoch !== undefined) {
      await leaveSession(queryClient, router, done.epoch);
    } else if (done) {
      // The server did not confirm: the outcome is indeterminate, so ask who the cookie is.
      setFailure(done.failure);
      await reconcileAndRevalidate(queryClient, client, router);
    }
    setIsBusy(false);
  }
  return { signOut, isBusy, failure };
}

async function leaveSession(
  queryClient: QueryClient,
  router: AnyRouter,
  revisionAtEnd: number,
): Promise<void> {
  try {
    await router.navigate({ to: "/login" });
  } catch (error) {
    console.error("Could not open the sign-in page after signing out", error);
  } finally {
    // A sign-in accepted after this sign-out changed the epoch: keep its session.
    clearAfterSignOut(queryClient, revisionAtEnd);
  }
}
