/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearch } from "@tanstack/react-router";
import { ApiError, unwrap } from "@wolbachia/api-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { PasswordField } from "../forms/PasswordField";
import { safeRedirect } from "../router/safe-redirect";
import { fetchMeCommitted } from "../session/me-query";
import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import { AuthLayout } from "./AuthLayout";

type Failure = "mismatch" | "wrongCurrent" | "weak" | "unchanged" | "failed";

function failureOf(error: unknown): Failure {
  if (!(error instanceof ApiError)) return "failed";
  if (error.status === 401) return "wrongCurrent";
  const code = error.envelope?.fields?.["new_password"]?.[0]?.code;
  if (code === "password_unchanged") return "unchanged";
  return code ? "weak" : "failed";
}

/** "Crea tu nueva contraseña": required right after signing in with a temporary password. */
export function ChangePasswordPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { redirect } = useSearch({ from: "/change-password" });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const submit = async () => {
    if (next !== confirm) {
      setFailure("mismatch");
      return;
    }
    setIsBusy(true);
    setFailure(null);
    try {
      unwrap(
        await client.POST("/api/v1/auth/password-change/", {
          body: { current_password: current, new_password: next },
        }),
      );
      await fetchMeCommitted({ client, queryClient });
      router.history.push(safeRedirect(redirect));
    } catch (error) {
      setFailure(failureOf(error));
    } finally {
      setIsBusy(false);
    }
  };
  return (
    <AuthLayout title={t("auth.change.title")}>
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isBusy) void submit();
        }}
      >
        <p className="m-0 text-sm text-ink-2">{t("auth.change.description")}</p>
        <PasswordField
          id="change-current-password"
          label={t("auth.change.current")}
          autoComplete="current-password"
          value={current}
          onChange={(event) => {
            setCurrent(event.target.value);
          }}
        />
        <PasswordField
          id="change-new-password"
          label={t("auth.reset.newPassword")}
          hint={t("auth.reset.hint")}
          autoComplete="new-password"
          value={next}
          onChange={(event) => {
            setNext(event.target.value);
          }}
        />
        <PasswordField
          id="change-confirm-password"
          label={t("auth.reset.confirmPassword")}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
          }}
        />
        {failure && (
          <InlineNotice tone="critical">{t(`auth.change.failure.${failure}`)}</InlineNotice>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            loading={isBusy}
            aria-disabled={!current || !next || !confirm || undefined}
          >
            {t("auth.change.submit")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
