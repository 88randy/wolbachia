import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormActions } from "../../components/templates/FormGrid";
import { buttonVariants } from "../../ui/button-variants";
import { Button } from "../../ui/Button";
import { CancelDeliveryDialog } from "./CancelDeliveryDialog";
import type { AssignmentPanelState } from "./use-assignment-panel";

function CancelAction({ panel, label }: { panel: AssignmentPanelState; label: string }) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  if (!panel.saved) return null;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        {t("allocation.delivery.cancel")}
      </Button>
      {isOpen && (
        <CancelDeliveryDialog
          assignment={panel.saved}
          label={label}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** Only what the delivery's state allows: edit and hand out, void, or go match the day. */
export function AssignmentActions({
  panel,
  courierName,
}: {
  panel: AssignmentPanelState;
  courierName: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { command, draft, saved, status } = panel;
  if (status === "received")
    return (
      <FormActions>
        <Link to="/inventory/reconciliations" className={buttonVariants({ variant: "primary" })}>
          {t("allocation.delivery.goReconcile")}
        </Link>
      </FormActions>
    );
  if (status === "released")
    return (
      <FormActions>
        <CancelAction panel={panel} label={courierName} />
      </FormActions>
    );
  const isBlocked = draft.blockers.length > 0;
  const needsSignature = !panel.signatureBlob;
  const reason = isBlocked
    ? t(draft.blockers[0] ?? "allocation.assignment.blockerLines")
    : saved && needsSignature
      ? t("allocation.assignment.needsSignature")
      : "";
  return (
    <FormActions>
      {reason && (
        <p id={id} className="m-0 mr-auto text-[13px] text-ink-2">
          {reason}
        </p>
      )}
      <Button
        variant={saved ? "secondary" : "primary"}
        loading={command.isBusy}
        aria-disabled={isBlocked || undefined}
        aria-describedby={isBlocked ? id : undefined}
        onClick={panel.create}
      >
        {t(saved ? "allocation.delivery.saveChanges" : "allocation.assignment.create")}
      </Button>
      {saved && (
        <Button
          loading={command.isBusy}
          aria-disabled={isBlocked || needsSignature || undefined}
          aria-describedby={reason ? id : undefined}
          onClick={() => {
            if (!isBlocked && !needsSignature) panel.release();
          }}
        >
          {t("allocation.assignment.release")}
        </Button>
      )}
    </FormActions>
  );
}
