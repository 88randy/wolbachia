import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { canDecide } from "./shift-validation";
import { useShiftDialog } from "./use-shift-dialog";
import type { ShiftDialogOptions } from "./use-shift-dialog";
import { ShiftDecisionForm } from "./ShiftDecisionForm";
export function ShiftDecisionDialog({ shift, kind, isReady, readSequence }: ShiftDialogOptions) {
  const { t } = useTranslation();
  const dialog = useShiftDialog({ shift, kind, isReady, readSequence });
  const isBlocked = !isReady || !canDecide(shift, kind);
  const label = t(kind === "approve" ? "shift.action.approve" : "shift.action.observe");
  return (
    <Dialog
      open={dialog.isOpen}
      onOpenChange={dialog.onOpenChange}
      title={label}
      description={t(kind === "approve" ? "shift.action.approveHint" : "shift.action.observeHint")}
      trigger={
        <Button variant={kind === "approve" ? "primary" : "secondary"} aria-disabled={isBlocked}>
          {label}
        </Button>
      }
    >
      <ShiftDecisionForm
        form={dialog.form}
        label={label}
        onSubmit={dialog.onSubmit}
        onCancel={dialog.onCancel}
      />
    </Dialog>
  );
}
