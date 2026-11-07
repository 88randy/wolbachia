import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { canFleetAction } from "./use-fleet-scope";
import type { FleetRecordScope } from "./use-fleet-scope";
import type { MotorcycleDetail } from "./fleet-query";
import type { useFleetOperations } from "./use-fleet-operations";
import { ServiceRecordDialog } from "./ServiceRecordDialog";
import { FaultClearanceDialog } from "./FaultClearanceDialog";
function OperationDialog({ operations }: { operations: ReturnType<typeof useFleetOperations> }) {
  if (!operations.visible || !operations.draft) return null;
  return operations.draft.kind === "service" ? (
    <ServiceRecordDialog draft={operations.draft} operations={operations} />
  ) : (
    <FaultClearanceDialog draft={operations.draft} operations={operations} />
  );
}
export function FleetRecordOperations({
  motorcycle,
  scope,
  operations,
}: {
  motorcycle: MotorcycleDetail;
  scope: FleetRecordScope;
  operations: ReturnType<typeof useFleetOperations>;
}) {
  const { t } = useTranslation();
  return (
    <>
      {canFleetAction(scope, motorcycle.center, "motorcycle.manage") && (
        <>
          <Button
            variant="secondary"
            aria-disabled={operations.isUnverified}
            onClick={operations.openService}
          >
            {t("fleet.action.service")}
          </Button>
          {operations.isUnverified && <p>{t("fleet.action.blocked")}</p>}
        </>
      )}
      <p role="status">{operations.saved ? t("fleet.action.saved") : ""}</p>
      {operations.denied && <p role="alert">{t("fleet.write.denied")}</p>}
      <OperationDialog operations={operations} />
    </>
  );
}
