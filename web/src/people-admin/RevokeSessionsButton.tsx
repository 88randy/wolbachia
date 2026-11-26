/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { useApiClient } from "../api/ApiClientProvider";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/toast-context";

/** "Sign out on their phone" for a lost phone; pending uploads still reach the server. */
export function RevokeSessionsButton({ personId, name }: { personId: string; name: string }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const { showToast } = useToast();
  const [isBusy, setBusy] = useState(false);
  const revoke = async () => {
    setBusy(true);
    const reply = await client.POST("/api/v1/users/{id}/revoke-device-sessions/", {
      params: { path: { id: personId } },
      body: { allow_final_upload: true },
    });
    setBusy(false);
    showToast(
      reply.data
        ? { message: t("users.revoke.done", { name }), tone: "success" }
        : { message: t("users.revoke.failed"), tone: "critical" },
    );
  };
  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="destructive"
          loading={isBusy}
          leadingIcon={<Smartphone aria-hidden="true" />}
        >
          {t("users.revoke.action")}
        </Button>
      }
      title={t("users.revoke.title", { name })}
      consequence={t("users.revoke.consequence")}
      actionLabel={t("users.revoke.confirm")}
      onConfirm={() => void revoke()}
    />
  );
}
