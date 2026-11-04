import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PasswordField } from "../forms/PasswordField";
import { TextField } from "../forms/TextField";
import { useFieldError } from "../forms/use-field-error";
import type { LoginValues } from "./login-schema";

interface LoginFieldsProps {
  form: UseFormReturn<LoginValues>;
  /** The server refused the credentials: both fields are marked, without saying which is wrong. */
  hasCredentialError: boolean;
}

/** Username and password. The browser and password managers recognize them by `autoComplete`. */
export function LoginFields({ form, hasCredentialError }: LoginFieldsProps) {
  const { t } = useTranslation();
  const fieldError = useFieldError();
  const { register, formState } = form;
  const describedBy = hasCredentialError ? "login-alert" : undefined;
  return (
    <>
      <TextField
        id="login-username"
        label={t("auth.login.username")}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={hasCredentialError || undefined}
        aria-describedby={describedBy}
        error={fieldError(formState.errors.username)}
        {...register("username")}
      />
      <PasswordField
        id="login-password"
        label={t("auth.login.password")}
        autoComplete="current-password"
        aria-invalid={hasCredentialError || undefined}
        aria-describedby={describedBy}
        error={fieldError(formState.errors.password)}
        {...register("password")}
      />
    </>
  );
}
