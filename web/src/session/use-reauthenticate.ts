import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useApiClient } from "../api/ApiClientProvider";
import type { LoginFailure } from "../auth/login-failure";
import { requestLogin } from "../auth/request-login";
import { useFocusAlert } from "../forms/use-focus-alert";
import { ME_QUERY_KEY } from "./me-query";
import { reauthSchema } from "./reauth-schema";
import type { ReauthValues } from "./reauth-schema";
import { endSessionExpiry } from "./session-events";
import { useMe } from "./use-me";

/**
 * Signs the same user in again without leaving the page: the screens stay mounted, so nothing
 * typed is lost. Afterwards every active query is refetched; the request that failed with the
 * 401 is NOT repeated, the user sends it again.
 */
export function useReauthenticate() {
  const { user } = useMe();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [failure, setFailure] = useState<LoginFailure | undefined>();
  const alertRef = useFocusAlert(failure);
  const form = useForm<ReauthValues>({
    resolver: zodResolver(reauthSchema),
    defaultValues: { password: "" },
  });
  const submit = form.handleSubmit(async ({ password }) => {
    setFailure(undefined);
    const outcome = await requestLogin(client, { username: user.username, password });
    if (!outcome.ok) {
      setFailure(outcome.failure);
      return;
    }
    queryClient.setQueryData(ME_QUERY_KEY, outcome.me);
    endSessionExpiry();
    void queryClient.invalidateQueries();
    if (outcome.me.organization === null) await router.navigate({ to: "/select-organization" });
  });
  return { form, username: user.username, failure, alertRef, submit };
}
