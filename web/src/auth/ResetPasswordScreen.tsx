import { useTranslation } from "react-i18next";
import { AuthLayout } from "./AuthLayout";
import { BackToLoginLink } from "./BackToLoginLink";
import { ResetLinkInvalid } from "./ResetLinkInvalid";
import { ResetPasswordForm } from "./ResetPasswordForm";
import type { ResetLink } from "./reset-link";

interface ResetPasswordScreenProps {
  /** What the emailed link carried, or `undefined` when it was missing or malformed. */
  link: ResetLink | undefined;
  /** A new revision starts the form over (a different link arrived in the same tab). */
  revision: number;
}

/** The reset page for either link format; the caller owns reading the link and the address bar. */
export function ResetPasswordScreen({ link, revision }: ResetPasswordScreenProps) {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t("auth.reset.title")}>
      {link ? (
        <ResetPasswordForm key={revision} uid={link.uid} token={link.token} />
      ) : (
        <ResetLinkInvalid key={revision} />
      )}
      <BackToLoginLink />
    </AuthLayout>
  );
}
