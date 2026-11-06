import { useTranslation } from "react-i18next";
import type { Motorcycle } from "./fleet-query";
import { MotorcycleReasonDialog } from "./MotorcycleReasonDialog";
import { UnblockDialog } from "./UnblockDialog";
import { MotorcycleActionControls } from "./MotorcycleActionControls";
import { useMotorcycleActions } from "./use-motorcycle-actions";
export function MotorcycleActions({
  motorcycle,
  isUnverified,
}: {
  motorcycle: Motorcycle;
  isUnverified: boolean;
}) {
  const { t } = useTranslation();
  const actions = useMotorcycleActions(motorcycle, isUnverified);
  const ReasonDialog = actions.action === "unblock" ? UnblockDialog : MotorcycleReasonDialog;
  return (
    <>
      <MotorcycleActionControls actions={actions} />
      <p role="status">{actions.hasSucceeded ? t("fleet.action.saved") : ""}</p>
      {actions.action !== undefined && actions.hasPermission && (
        <ReasonDialog motorcycle={motorcycle} onDone={actions.done} onCancel={actions.close} />
      )}
    </>
  );
}
