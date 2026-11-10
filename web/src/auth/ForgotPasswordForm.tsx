import { useTranslation } from "react-i18next";
import formStyles from "../forms/form.module.css";
import { FormNotice } from "../forms/FormNotice";
import { ServiceFailureAlert } from "../forms/ServiceFailureAlert";
import { SubmitButton } from "../forms/SubmitButton";
import { TextField } from "../forms/TextField";
import { useFieldError } from "../forms/use-field-error";
import styles from "./auth.module.css";
import { useForgotPasswordForm } from "./use-forgot-password-form";

/**
 * Asks for the account's email. After the request it always shows the same confirmation, so
 * the screen never reveals whether an address is registered.
 */
export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const { form, isSent, failure, alertRef, submit } = useForgotPasswordForm();
  const fieldError = useFieldError();
  if (isSent) {
    return (
      <FormNotice shouldFocus title={t("auth.forgot.sentTitle")} text={t("auth.forgot.sent")} />
    );
  }
  return (
    <form className={formStyles.form} noValidate onSubmit={(event) => void submit(event)}>
      <p className={styles.body}>{t("auth.forgot.body")}</p>
      <ServiceFailureAlert id="forgot-alert" ref={alertRef} failure={failure} />
      <TextField
        id="forgot-email"
        label={t("auth.forgot.email")}
        type="email"
        autoComplete="email"
        error={fieldError(form.formState.errors.email)}
        {...form.register("email")}
      />
      <SubmitButton
        block
        label={t("auth.forgot.submit")}
        busyLabel={t("auth.login.submitting")}
        isBusy={form.formState.isSubmitting}
      />
    </form>
  );
}
