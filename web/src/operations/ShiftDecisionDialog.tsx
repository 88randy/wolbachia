import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { useToast } from "../ui/toast-context";
import { canDecide } from "./shift-validation";
import type { DecisionKind, ShiftDetail } from "./shift-validation";
import { useShiftDecision } from "./use-shift-decision";
import { ShiftDecisionForm } from "./ShiftDecisionForm";
interface Props { shift: ShiftDetail; kind: DecisionKind; isReady: boolean; readSequence: number }
export function ShiftDecisionDialog({ shift, kind, isReady, readSequence }: Props) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const form = useShiftDecision({ shift, kind, isReady, readSequence });
  const toast = useToast();
  const isBlocked = !isReady || !canDecide(shift, kind);
  const label = t(kind === "approve" ? "shift.action.approve" : "shift.action.observe");
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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} title={label}
      description={t(kind === "approve" ? "shift.action.approveHint" : "shift.action.observeHint")}
      trigger={<Button variant={kind === "approve" ? "primary" : "secondary"} aria-disabled={isBlocked}>{label}</Button>}>
      <ShiftDecisionForm form={form} label={label} onSubmit={onSubmit} onCancel={() => { onOpenChange(false); }} />
    </Dialog>
  );
}
