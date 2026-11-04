import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useApiClient } from "../api/ApiClientProvider";
import type { LoginFailure } from "../auth/login-failure";
import { requestLogin } from "../auth/request-login";
import { useFocusAlert } from "../forms/use-focus-alert";
import { runAuthOperation, useAbandonOnUnmount } from "./auth-operation";
import { recordIdentity } from "./identity";
import type { Me } from "./me";
import { ME_QUERY_KEY } from "./me-query";
import { reauthSchema } from "./reauth-schema";
import type { ReauthValues } from "./reauth-schema";
import { endSessionExpiry } from "./session-events";
import { useMe } from "./use-me";

/** The session is back: store `/me/`, drop another user's or organization's cache, refetch. */
async function acceptLogin(me: Me, queryClient: QueryClient, router: AnyRouter): Promise<void> {
  recordIdentity(queryClient, me);
  queryClient.setQueryData(ME_QUERY_KEY, me);
  endSessionExpiry();
  void queryClient.invalidateQueries();
  if (me.organization === null) await router.navigate({ to: "/select-organization" });
}

/**
 * Signs the same user in again without leaving the page: the screens stay mounted, so nothing
 * typed is lost. Afterwards every active query is refetched; the request that failed with the
 * 401 is NOT repeated, the user sends it again. If the session lands in another organization
 * (the stored slug was refused) the old organization's cache is dropped and the guards run again.
 * It is queued with the other auth operations and abandoned if the dialog goes away.
 */
export function useReauthenticate() {
  const { user } = useMe();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [failure, setFailure] = useState<LoginFailure | undefined>();
  const alertRef = useFocusAlert(failure);
  const abandonRef = useAbandonOnUnmount();
  const form = useForm<ReauthValues>({
    resolver: zodResolver(reauthSchema),
    defaultValues: { password: "" },
  });
  const submit = form.handleSubmit(async ({ password }) => {
    setFailure(undefined);
    const credentials = { username: user.username, password };
    const run = runAuthOperation("login", async ({ signal, isCurrent }) => {
      const outcome = await requestLogin(client, credentials, signal);
      if (!isCurrent()) return;
      if (outcome.ok) await acceptLogin(outcome.me, queryClient, router);
      else setFailure(outcome.failure);
    });
    abandonRef.current = run.abandon;
    await run.result;
  });
  return { form, username: user.username, failure, alertRef, submit };
}
