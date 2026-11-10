import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { reportSessionError } from "../session/session-events";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useToast } from "../ui/toast-context";

interface RegActionOptions<Input> {
  run: (input: Input, signal: AbortSignal) => Promise<unknown>;
  successKey: MessageKey;
}

/** One server command of the regulatory area: refreshes its lists and answers in a toast. */
export function useRegAction<Input>({ run, successKey }: RegActionOptions<Input>) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: (input: Input) => run(input, new AbortController().signal),
    onSuccess: () => {
      void invalidateOrgScoped(cache, "regulatory");
      showToast({ message: t(successKey), tone: "success" });
    },
    onError: (error) => {
      reportSessionError(error, cache);
    },
  });
  return {
    submit: (input: Input, onDone?: () => void) => {
      mutation.mutate(input, { onSuccess: onDone });
    },
    isBusy: mutation.isPending,
    hasFailed: mutation.isError,
    reset: mutation.reset,
  };
}
