import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { reportSessionError } from "../session/session-events";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { useToast } from "../ui/toast-context";

interface LabActionOptions<Input> {
  run: (input: Input, signal: AbortSignal) => Promise<unknown>;
  successKey: MessageKey;
}

/** One server command from the lab: refreshes the lab lists and reports in a toast. */
export function useLabAction<Input>({ run, successKey }: LabActionOptions<Input>) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: (input: Input) => run(input, new AbortController().signal),
    onSuccess: () => {
      void invalidateOrgScoped(cache, "lab");
      showToast({ message: t(successKey), tone: "success" });
    },
    onError: (error) => {
      reportSessionError(error, cache);
      showToast({ message: t("lab.error.rejected"), tone: "critical" });
    },
  });
  const submit = (input: Input, onDone?: () => void) => {
    mutation.mutate(input, { onSuccess: onDone });
  };
  return { submit, isBusy: mutation.isPending };
}
