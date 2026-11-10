import { useTranslation } from "react-i18next";
import formStyles from "../forms/form.module.css";
import { ServiceFailureAlert } from "../forms/ServiceFailureAlert";
import { SubmitButton } from "../forms/SubmitButton";
import { ResetLinkInvalid } from "./ResetLinkInvalid";
import { ResetPasswordFields } from "./ResetPasswordFields";
import { useResetPasswordForm } from "./use-reset-password-form";

interface ResetPasswordFormProps {
  uid: string;
  token: string;
}

/** New password and confirmation. The link is checked by the server when the form is sent. */
export function ResetPasswordForm({ uid, token }: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const { form, isLinkInvalid, failure, alertRef, submit } = useResetPasswordForm({ uid, token });
  if (isLinkInvalid) return <ResetLinkInvalid />;
  return (
    <form className={formStyles.form} noValidate onSubmit={(event) => void submit(event)}>
      <ServiceFailureAlert id="reset-alert" ref={alertRef} failure={failure} />
      <ResetPasswordFields form={form} />
      <SubmitButton
        block
        label={t("auth.reset.submit")}
        busyLabel={t("auth.login.submitting")}
        isBusy={form.formState.isSubmitting}
      />
    </form>
  );
}
