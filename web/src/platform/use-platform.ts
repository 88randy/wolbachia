import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { reportSessionError } from "../session/session-events";
import { useSessionIdentity } from "../session/use-session-identity";
import { useToast } from "../ui/toast-context";
import { PLATFORM_RESOURCE } from "./platform-queries";
import type { PlatformScope } from "./platform-queries";

export function usePlatformScope(): PlatformScope {
  return { client: useApiClient(), identity: useSessionIdentity() };
}

interface ActionOptions<Input, Output> {
  run: (input: Input, signal: AbortSignal) => Promise<Output>;
  successKey?: MessageKey;
}

/** One platform command: refreshes the platform lists and answers in a toast. */
export function usePlatformAction<Input, Output = unknown>({
  run,
  successKey,
}: ActionOptions<Input, Output>) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: (input: Input) => run(input, new AbortController().signal),
    onSuccess: () => {
      void invalidateOrgScoped(cache, PLATFORM_RESOURCE);
      if (successKey) showToast({ message: t(successKey), tone: "success" });
    },
    onError: (error) => {
      reportSessionError(error, cache);
    },
  });
  return {
    submit: (input: Input, onDone?: (output: Output) => void) => {
      mutation.mutate(input, { onSuccess: onDone });
    },
    isBusy: mutation.isPending,
    hasFailed: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
