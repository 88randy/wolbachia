import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { serviceFailureOf } from "../api/service-failure";
import type { ServiceFailure } from "../api/service-failure";
import { useFocusAlert } from "../forms/use-focus-alert";
import { safeRedirect } from "../router/safe-redirect";
import { switchOrganization } from "../session/organization-switch";
import { ApiError } from "@wolbachia/api-client";

const HTTP_UNAUTHORIZED = 401;

function failureOf(error: unknown): ServiceFailure {
  return error instanceof ApiError ? serviceFailureOf(error.status) : "network";
}

/**
 * Chooses the organization: stores it, clears the previous organization's cache, refreshes
 * `/me/` and continues to the requested route. A slug the server does not accept leaves the user
 * here with an error instead of in a half-selected state.
 */
export function useSelectOrganization(requestedTarget: string | undefined) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<ServiceFailure | undefined>();
  const alertRef = useFocusAlert(failure);
  async function goToSignIn(): Promise<void> {
    const target = safeRedirect(requestedTarget);
    await router.navigate({ to: "/login", search: target === "/" ? {} : { redirect: target } });
  }
  async function select(slug: string): Promise<void> {
    setIsBusy(true);
    setFailure(undefined);
    try {
      const me = await switchOrganization(queryClient, client, slug);
      if (me.organization === null) setFailure("generic");
      else router.history.push(safeRedirect(requestedTarget));
    } catch (error) {
      console.error("Could not switch organization", error);
      if (error instanceof ApiError && error.status === HTTP_UNAUTHORIZED) await goToSignIn();
      else setFailure(failureOf(error));
    } finally {
      setIsBusy(false);
    }
  }
  return { select, isBusy, failure, alertRef };
}
