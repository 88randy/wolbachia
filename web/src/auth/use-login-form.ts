import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useFocusAlert } from "../forms/use-focus-alert";
import { loginSchema } from "./login-schema";
import type { LoginValues } from "./login-schema";
import type { LoginFailure } from "./login-failure";
import { useLogin } from "./use-login";

/**
 * State of the sign-in form: validation, submit and the failure to show. A failed submit moves
 * focus to the error summary (server failures) or to the first invalid field (React Hook Form
 * does that itself for validation errors).
 */
export function useLoginForm(requestedTarget: string | undefined) {
  const login = useLogin(requestedTarget);
  const [failure, setFailure] = useState<LoginFailure | undefined>();
  const alertRef = useFocusAlert(failure);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const submit = form.handleSubmit(async (values) => {
    setFailure(undefined);
    setFailure(await login(values));
  });
  return { form, failure, alertRef, submit };
}
