import { useTranslation } from "react-i18next";
import { AuthLayout } from "./AuthLayout";
import { BackToLoginLink } from "./BackToLoginLink";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

/** Request of a password reset link (public). */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t("auth.forgot.title")}>
      <ForgotPasswordForm />
      <BackToLoginLink />
    </AuthLayout>
  );
}
