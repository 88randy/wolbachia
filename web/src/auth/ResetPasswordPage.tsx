import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "./AuthLayout";
import { BackToLoginLink } from "./BackToLoginLink";
import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * Target of the emailed link, `/reset-password/{uid}/{token}` (the path the backend builds from
 * `WEB_PASSWORD_RESET_PATH`). The token lives only in this URL and in the request body.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { uid, token } = useParams({ from: "/reset-password/$uid/$token" });
  return (
    <AuthLayout title={t("auth.reset.title")}>
      <ResetPasswordForm uid={uid} token={token} />
      <BackToLoginLink />
    </AuthLayout>
  );
}
