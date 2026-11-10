import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import formStyles from "../forms/form.module.css";
import { SubmitButton } from "../forms/SubmitButton";
import type { LOGIN_NOTICES } from "../router/search-schemas";
import styles from "./auth.module.css";
import { LoginFailureAlert } from "./LoginFailureAlert";
import { LoginFields } from "./LoginFields";
import { LoginNotice } from "./LoginNotice";
import { useLoginForm } from "./use-login-form";

interface LoginFormProps {
  /** The `redirect` search parameter, as typed in the URL: validated before it is used. */
  redirectTo: string | undefined;
  notice: (typeof LOGIN_NOTICES)[number] | undefined;
}

/** W1: username, password, the error summary, "forgot my password" and the no-sign-up note. */
export function LoginForm({ redirectTo, notice }: LoginFormProps) {
  const { t } = useTranslation();
  const { form, failure, alertRef, submit } = useLoginForm(redirectTo);
  return (
    <form className={formStyles.form} noValidate onSubmit={(event) => void submit(event)}>
      <LoginNotice notice={notice} />
      <LoginFailureAlert failure={failure} ref={alertRef} />
      <LoginFields form={form} hasCredentialError={failure?.kind === "credentials"} />
      <SubmitButton
        block
        label={t("auth.login.submit")}
        busyLabel={t("auth.login.submitting")}
        isBusy={form.formState.isSubmitting}
      />
      <Link to="/forgot-password" className={styles.linkButton}>
        {t("auth.login.forgot")}
      </Link>
      <p className={styles.note}>{t("auth.login.noSignUp")}</p>
    </form>
  );
}
