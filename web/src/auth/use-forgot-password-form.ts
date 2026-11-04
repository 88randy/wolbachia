import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useApiClient } from "../api/ApiClientProvider";
import type { ServiceFailure } from "../api/service-failure";
import { useFocusAlert } from "../forms/use-focus-alert";
import { forgotSchema } from "./forgot-schema";
import type { ForgotValues } from "./forgot-schema";
import { requestPasswordReset } from "./request-password-reset";

/** State of the "forgot my password" form: validation, the request, the failure and "sent". */
export function useForgotPasswordForm() {
  const client = useApiClient();
  const [isSent, setIsSent] = useState(false);
  const [failure, setFailure] = useState<ServiceFailure | undefined>();
  const alertRef = useFocusAlert(failure);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const submit = form.handleSubmit(async ({ email }) => {
    setFailure(undefined);
    const outcome = await requestPasswordReset(client, email);
    if (outcome.ok) setIsSent(true);
    else setFailure(outcome.failure);
  });
  return { form, isSent, failure, alertRef, submit };
}
