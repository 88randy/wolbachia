/* eslint-disable max-lines-per-function -- presentational JSX of a dialog; splitting it into one-use fragments would hurt readability. */
import { unwrap } from "@wolbachia/api-client";
import { Ban } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "../../regulatory/FormDialog";
import { useRegAction } from "../../regulatory/use-reg-action";
import { useRegScope } from "../../regulatory/use-reg-list";
import { Button } from "../../ui/Button";
import type { ApiKeyRow } from "./api-keys-queries";

const MIN_REASON = 10;

/** Revoke a key with a reason: it is never edited or deleted, and it cannot be reactivated. */
export function ApiKeyRevokeDialog({ row }: { row: ApiKeyRow }) {
  const { t } = useTranslation();
  const { client } = useRegScope();
  const [reason, setReason] = useState("");
  const action = useRegAction({
    successKey: "apiKeys.revoked",
    run: async (text: string, signal) =>
      unwrap(
        await client.POST("/api/v1/api-keys/{id}/revoke/", {
          params: { path: { id: row.id } },
          body: { reason: text },
          signal,
        }),
      ),
  });
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="ghost" leadingIcon={<Ban aria-hidden="true" />}>
          {t("apiKeys.revoke")}
        </Button>
      }
      title={t("apiKeys.revokeTitle")}
      description={t("apiKeys.revokeDescription")}
      submitLabel={t("apiKeys.revokeSubmit")}
      destructive
      canSubmit={reason.trim().length >= MIN_REASON}
      isBusy={action.isBusy}
      hasFailed={action.hasFailed}
      onReset={() => {
        setReason("");
        action.reset();
      }}
      onSubmit={(close) => {
        action.submit(reason.trim(), close);
      }}
    >
      <p className="m-0 text-sm font-semibold text-ink">{row.institution}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`revoke-key-reason-${row.id}`} className="text-xs font-semibold text-ink-2">
          {t("apiKeys.revokeReason")}
        </label>
        <Textarea
          id={`revoke-key-reason-${row.id}`}
          value={reason}
          maxLength={1000}
          required
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </div>
    </FormDialog>
  );
}
