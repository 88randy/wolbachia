import { useTranslation } from "react-i18next";
import type { Motorcycle } from "./fleet-query";
import { MotorcycleReasonDialog } from "./MotorcycleReasonDialog";
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
  return (
    <>
      <MotorcycleActionControls actions={actions} />
      <p role="status">{actions.hasSucceeded ? t("fleet.action.saved") : ""}</p>
      {actions.action !== undefined && actions.hasPermission && (
        <MotorcycleReasonDialog
          motorcycle={motorcycle}
          action={actions.action}
          onDone={actions.done}
          onCancel={actions.close}
        />
      )}
    </>
  );
}
