import { unwrap } from "@wolbachia/api-client";
import { Ban } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "../../ui/Button";
import { FormDialog } from "../FormDialog";
import { useRegScope } from "../use-reg-list";
import { useRegAction } from "../use-reg-action";
import type { TransferRow } from "../reg-queries";

const MIN_REASON = 5;

/** Revoke an authorization with a reason: it is never edited or deleted. */
export function TransferRevokeDialog({ row }: { row: TransferRow }) {
  const { t } = useTranslation();
  const { client } = useRegScope();
  const [reason, setReason] = useState("");
  const action = useRegAction({
    successKey: "regulatory.transfers.revoked",
    run: async (text: string, signal) =>
      unwrap(
        await client.POST("/api/v1/data-transfers/{id}/revoke/", {
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
          {t("regulatory.transfers.revoke")}
        </Button>
      }
      title={t("regulatory.transfers.revokeTitle")}
      description={t("regulatory.transfers.revokeDescription")}
      submitLabel={t("regulatory.transfers.revokeSubmit")}
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
      <p className="m-0 text-sm font-semibold text-ink">{row.recipient_institution}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`revoke-reason-${row.id}`} className="text-xs font-semibold text-ink-2">
          {t("regulatory.transfers.revokeReason")}
        </label>
        <Textarea
          id={`revoke-reason-${row.id}`}
          value={reason}
          maxLength={2000}
          required
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </div>
    </FormDialog>
  );
}
