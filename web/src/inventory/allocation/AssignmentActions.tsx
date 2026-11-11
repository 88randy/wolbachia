import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormActions } from "../../components/templates/FormGrid";
import { Button } from "../../ui/Button";
import type { AssignmentPanelState } from "./use-assignment-panel";

/** Save the delivery, or send the saved assignment to the courier's phone for signature. */
export function AssignmentActions({ panel }: { panel: AssignmentPanelState }) {
  const { t } = useTranslation();
  const id = useId();
  const { command, draft } = panel;
  if (panel.saved) {
    const isSent = command.result?.kind === "release";
    const needsSignature = !panel.signatureBlob && !isSent;
    return (
      <FormActions>
        {needsSignature && (
          <p id={id} className="m-0 mr-auto text-[13px] text-ink-2">
            {t("allocation.assignment.needsSignature")}
          </p>
        )}
        <Button
          loading={command.isBusy}
          disabled={isSent}
          aria-disabled={needsSignature || undefined}
          aria-describedby={needsSignature ? id : undefined}
          onClick={() => {
            if (!needsSignature) panel.release();
          }}
        >
          {t("allocation.assignment.release")}
        </Button>
      </FormActions>
    );
  }
  const isBlocked = draft.blockers.length > 0;
  return (
    <FormActions>
      {isBlocked && (
        <p id={id} className="m-0 mr-auto text-[13px] text-ink-2">
          {t(draft.blockers[0] ?? "allocation.assignment.blockerLines")}
        </p>
      )}
      <Button
        loading={command.isBusy}
        aria-disabled={isBlocked || undefined}
        aria-describedby={isBlocked ? id : undefined}
        onClick={panel.create}
      >
        {t("allocation.assignment.create")}
      </Button>
    </FormActions>
  );
}
