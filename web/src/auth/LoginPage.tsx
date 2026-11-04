import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ME_QUERY_KEY } from "../session/me-query";
import { clearOrganizationSlug } from "../session/organization-slug";
import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";
import { useCsrfBootstrap } from "./use-csrf-bootstrap";

/** W1 sign-in (public). Prepares the CSRF cookie as soon as it opens. */
export function LoginPage() {
  const { t } = useTranslation();
  const { redirect, notice } = useSearch({ from: "/login" });
  useCsrfBootstrap();
  const queryClient = useQueryClient();
  useEffect(() => {
    // Nobody is signed in here (no cached /me/): an organization left from a previous session
    // would be sent to the next user's login and refused.
    if (queryClient.getQueryData(ME_QUERY_KEY) === undefined) clearOrganizationSlug();
  }, [queryClient]);
  return (
    <AuthLayout title={t("auth.login.title")}>
      <LoginForm redirectTo={redirect} notice={notice} />
    </AuthLayout>
  );
}
