import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";
import { useCsrfBootstrap } from "./use-csrf-bootstrap";

/** W1 sign-in (public). Prepares the CSRF cookie as soon as it opens. */
export function LoginPage() {
  const { t } = useTranslation();
  const { redirect, notice } = useSearch({ from: "/login" });
  useCsrfBootstrap();
  return (
    <AuthLayout title={t("auth.login.title")}>
      <LoginForm redirectTo={redirect} notice={notice} />
    </AuthLayout>
  );
}
