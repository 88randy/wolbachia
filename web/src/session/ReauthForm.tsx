import { useTranslation } from "react-i18next";
import { LoginFailureAlert } from "../auth/LoginFailureAlert";
import formStyles from "../forms/form.module.css";
import { PasswordField } from "../forms/PasswordField";
import { TextField } from "../forms/TextField";
import { useFieldError } from "../forms/use-field-error";
import { ReauthActions } from "./ReauthActions";
import { useReauthenticate } from "./use-reauthenticate";

/** Password (the username is read-only) and the two ways out: continue, or sign out. */
export function ReauthForm() {
  const { t } = useTranslation();
  const { form, username, failure, alertRef, submit } = useReauthenticate();
  const fieldError = useFieldError();
  return (
    <form className={formStyles.form} noValidate onSubmit={(event) => void submit(event)}>
      <LoginFailureAlert failure={failure} ref={alertRef} />
      <TextField
        id="reauth-username"
        label={t("auth.login.username")}
        autoComplete="username"
        value={username}
        readOnly
      />
      <PasswordField
        id="reauth-password"
        label={t("auth.login.password")}
        autoComplete="current-password"
        error={fieldError(form.formState.errors.password)}
        {...form.register("password")}
      />
      <ReauthActions isSubmitting={form.formState.isSubmitting} />
    </form>
  );
}
