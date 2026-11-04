import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import { FormNotice } from "../forms/FormNotice";
import type { LOGIN_NOTICES } from "../router/search-schemas";

interface LoginNoticeProps {
  /** From the `notice` search parameter; anything unknown was already dropped by the route. */
  notice: (typeof LOGIN_NOTICES)[number] | undefined;
}

/** What brought the user to the sign-in page: a finished reset, or an account with no access. */
export function LoginNotice({ notice }: LoginNoticeProps) {
  const { t } = useTranslation();
  if (notice === "password-changed") return <FormNotice title={t("auth.login.passwordChanged")} />;
  if (notice === "no-membership") {
    return <FormAlert id="login-notice" title={t("auth.login.noMembership")} />;
  }
  return null;
}
