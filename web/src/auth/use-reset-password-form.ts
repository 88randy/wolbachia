import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { useFocusAlert } from "../forms/use-focus-alert";
import { confirmPasswordReset } from "./request-password-reset-confirm";
import type { ResetConfirmOutcome } from "./request-password-reset-confirm";
import type { ResetLink } from "./reset-link";
import { resetSchema } from "./reset-schema";
import type { ResetValues } from "./reset-schema";
import { useAbortOnUnmount } from "./use-abort-on-unmount";

interface OutcomeEffects {
  form: UseFormReturn<ResetValues>;
  showInvalidLink: () => void;
  showFailure: (failure: ServiceFailure) => void;
  signIn: () => Promise<void>;
}

/** Turns the server's answer into what the screen shows. A weak password marks its field. */
async function applyOutcome(outcome: ResetConfirmOutcome, effects: OutcomeEffects): Promise<void> {
  if (outcome.ok) {
    await effects.signIn();
  } else if (outcome.reason === "invalidLink") {
    effects.showInvalidLink();
  } else if (outcome.reason === "service") {
    effects.showFailure(outcome.failure);
  } else {
    const error = { type: "server", message: outcome.messageKey };
    effects.form.setError("newPassword", error, { shouldFocus: true });
  }
}

/**
 * State of the reset form (the target of the emailed link): validation, the request, server
 * password errors mapped onto the field, a bad-link state and the redirect to sign-in.
 */
export function useResetPasswordForm(link: ResetLink) {
  const client = useApiClient();
  const router = useRouter();
  const [isLinkInvalid, setIsLinkInvalid] = useState(false);
  const [failure, setFailure] = useState<ServiceFailure | undefined>();
  const alertRef = useFocusAlert(failure);
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  const effects: OutcomeEffects = {
    form,
    showInvalidLink: () => {
      setIsLinkInvalid(true);
    },
    showFailure: setFailure,
    signIn: () => router.navigate({ to: "/login", search: { notice: "password-changed" } }),
  };
  // The form is replaced (or closed) when another link arrives: its request is cancelled and
  // its answer ignored, so a late reply can neither navigate nor touch the new form.
  const startRequest = useAbortOnUnmount();
  const submit = form.handleSubmit(async ({ newPassword }) => {
    setFailure(undefined);
    const controller = startRequest();
    const outcome = await confirmPasswordReset(client, { ...link, newPassword }, controller.signal);
    if (!controller.signal.aborted) await applyOutcome(outcome, effects);
  });
  return { form, isLinkInvalid, failure, alertRef, submit };
}
