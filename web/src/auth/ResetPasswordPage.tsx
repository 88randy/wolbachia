import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { replaceAddressBar } from "../router/replace-address-bar";
import { AuthLayout } from "./AuthLayout";
import { BackToLoginLink } from "./BackToLoginLink";
import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * Target of the emailed link, `/reset-password/{uid}/{token}` (the path the backend builds from
 * `WEB_PASSWORD_RESET_PATH`). The token is kept in memory and the address bar is rewritten to
 * `/reset-password` on mount, so it does not stay in the history, a screenshot or a copied link;
 * it travels only in the request body. (Reloading therefore needs the emailed link again.)
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const params = useParams({ from: "/reset-password/$uid/$token" });
  const [{ uid, token }] = useState(params);
  useEffect(() => {
    replaceAddressBar("/reset-password");
  }, []);
  return (
    <AuthLayout title={t("auth.reset.title")}>
      <ResetPasswordForm uid={uid} token={token} />
      <BackToLoginLink />
    </AuthLayout>
  );
}
