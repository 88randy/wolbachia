import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import { loginFailureMessage } from "./login-failure";
import type { LoginFailure } from "./login-failure";

interface LoginFailureAlertProps {
  failure: LoginFailure | undefined;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Error summary of the sign-in form. A wrong password, an unknown user and an inactive user all
 * read the same, and the remaining attempts are not shown (the API does not provide them).
 */
export function LoginFailureAlert({ failure, ref }: LoginFailureAlertProps) {
  const { t } = useTranslation();
  if (failure === undefined) return null;
  const { key, hintKey, params } = loginFailureMessage(failure);
  return (
    <FormAlert
      id="login-alert"
      ref={ref}
      title={t(key, params)}
      text={hintKey === undefined ? undefined : t(hintKey)}
    />
  );
}
