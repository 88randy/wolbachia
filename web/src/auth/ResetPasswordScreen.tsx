import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { replaceAddressBar } from "../router/replace-address-bar";
import { AuthLayout } from "./AuthLayout";
import { BackToLoginLink } from "./BackToLoginLink";
import { ResetLinkInvalid } from "./ResetLinkInvalid";
import { ResetPasswordForm } from "./ResetPasswordForm";
import type { ResetLink } from "./reset-link";

/** Where the address bar is left once the link has been read: no token, no fragment. */
const CLEAN_ADDRESS = "/reset-password";

interface ResetPasswordScreenProps {
  /** What the emailed link carried, or `undefined` when it was missing or malformed. */
  link: ResetLink | undefined;
}

/**
 * The reset page for either link format. The values live in memory (the caller read them once)
 * and the address bar is rewritten on mount, so they do not stay in the history, a screenshot or
 * a copied link; they travel only in the request body.
 */
export function ResetPasswordScreen({ link }: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  useEffect(() => {
    replaceAddressBar(CLEAN_ADDRESS);
  }, []);
  return (
    <AuthLayout title={t("auth.reset.title")}>
      {link ? <ResetPasswordForm uid={link.uid} token={link.token} /> : <ResetLinkInvalid />}
      <BackToLoginLink />
    </AuthLayout>
  );
}
