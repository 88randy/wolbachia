import { useState } from "react";
import type { ReceptionActions } from "./use-reception-command";
import type { ReceptionRow } from "./reception-query";

/** Keep the reason until a confirmed result closes this bag's dialog. */
interface MissingOptions {
  row: ReceptionRow;
  actions: ReceptionActions;
  isReady: boolean;
}
export function useMissingReception({ row, actions, isReady }: MissingOptions) {
  const [isOpen, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [hasSubmitted, setSubmitted] = useState(false);
  const onOpenChange = (open: boolean) => {
    setOpen(open);
    if (open) setSubmitted(false);
  };
  const submit = () => {
    if (!row.bagId || !reason.trim() || !isReady || actions.isBusy || actions.isReviewRequired)
      return;
    actions.setResult(null);
    setSubmitted(true);
    void actions
      .submit({ kind: "missing", id: row.bagId, reason, command_id: crypto.randomUUID() })
      .then((isSaved) => {
        if (isSaved) setOpen(false);
      });
  };
  return {
    isReady,
    isOpen,
    onOpenChange,
    reason,
    setReason,
    submit,
    feedback: hasSubmitted ? actions.result : null,
  };
}
export type MissingReceptionForm = ReturnType<typeof useMissingReception>;
