import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../ui/toast-context";
import type { DecisionKind, ShiftDetail } from "./shift-validation";
import { useShiftDecision } from "./use-shift-decision";

export interface ShiftDialogOptions {
  shift: ShiftDetail;
  kind: DecisionKind;
  isReady: boolean;
  readSequence: number;
}

/** Close and announce only while the completed audit still belongs to the active session. */
export function useShiftDialog(options: ShiftDialogOptions) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const form = useShiftDecision(options);
  const toast = useToast();
  const onOpenChange = (open: boolean) => {
    if (form.isBusy) return;
    if (open) form.startReview();
    setOpen(open);
  };
  const onSubmit = async () => {
    const guard = await form.submit();
    if (!guard || guard.isStale()) return;
    setOpen(false);
    toast.showToast({ message: t("shift.history.saved"), tone: "success" });
  };
  const onCancel = () => {
    onOpenChange(false);
  };
  return { isOpen, form, onOpenChange, onSubmit, onCancel };
}
