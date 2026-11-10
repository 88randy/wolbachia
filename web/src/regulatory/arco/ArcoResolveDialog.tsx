import { unwrap } from "@wolbachia/api-client";
import { CheckCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "../../ui/Button";
import { SelectMenu } from "../../ui/SelectMenu";
import { FormDialog } from "../FormDialog";
import type { ArcoRow } from "../reg-queries";
import { useRegAction } from "../use-reg-action";
import { useRegScope } from "../use-reg-list";

type Outcome = "resolved" | "rejected";
const OUTCOMES: readonly Outcome[] = ["resolved", "rejected"];

/** Close a request with its answer; there is no reopening, a new request is registered instead. */
export function ArcoResolveDialog({ row }: { row: ArcoRow }) {
  const { t } = useTranslation();
  const { client } = useRegScope();
  const [outcome, setOutcome] = useState<Outcome>("resolved");
  const [note, setNote] = useState("");
  const action = useRegAction({
    successKey: "regulatory.arco.resolved",
    run: async (_input: null, signal) =>
      unwrap(
        await client.POST("/api/v1/arco-requests/{id}/resolve/", {
          params: { path: { id: row.id } },
          body: { outcome, resolution_note: note.trim() },
          signal,
        }),
      ),
  });
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="ghost" leadingIcon={<CheckCheck aria-hidden="true" />}>
          {t("regulatory.arco.resolve")}
        </Button>
      }
      title={t("regulatory.arco.resolveTitle")}
      description={t("regulatory.arco.resolveDescription")}
      submitLabel={t("regulatory.arco.resolveSubmit")}
      canSubmit={note.trim() !== ""}
      isBusy={action.isBusy}
      hasFailed={action.hasFailed}
      onReset={() => {
        setOutcome("resolved");
        setNote("");
        action.reset();
      }}
      onSubmit={(close) => {
        action.submit(null, close);
      }}
    >
      <p className="m-0 text-sm font-semibold text-ink">{row.requester_reference}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`arco-outcome-${row.id}`} className="text-xs font-semibold text-ink-2">
          {t("regulatory.arco.outcome")}
        </label>
        <SelectMenu
          id={`arco-outcome-${row.id}`}
          value={outcome}
          options={OUTCOMES.map((value) => ({
            value,
            label: t(`regulatory.arco.outcome.${value}`),
          }))}
          onValueChange={(value) => {
            setOutcome(value === "rejected" ? "rejected" : "resolved");
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`arco-note-${row.id}`} className="text-xs font-semibold text-ink-2">
          {t("regulatory.arco.note")}
        </label>
        <Textarea
          id={`arco-note-${row.id}`}
          value={note}
          maxLength={4000}
          required
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </div>
    </FormDialog>
  );
}
