import { useTranslation } from "react-i18next";
import type { FleetRecordScope } from "./use-fleet-scope";
import type { useFleetOperations } from "./use-fleet-operations";
import { ServiceRecordDialog } from "./ServiceRecordDialog";
import { FaultClearanceDialog } from "./FaultClearanceDialog";

type Operations = ReturnType<typeof useFleetOperations>;

function OperationDialog({
  operations,
  scope,
}: {
  operations: Operations;
  scope: FleetRecordScope;
}) {
  if (!operations.visible || !operations.draft) return null;
  return operations.draft.kind === "service" ? (
    <ServiceRecordDialog draft={operations.draft} operations={operations} />
  ) : (
    <FaultClearanceDialog draft={operations.draft} operations={operations} scope={scope} />
  );
}

/** The service and fault-clearance dialogs plus their outcome; the buttons live in the header. */
export function FleetRecordOperations({
  scope,
  operations,
}: {
  scope: FleetRecordScope;
  operations: Operations;
}) {
  const { t } = useTranslation();
  return (
    <>
      <p role="status" className="sr-only">
        {operations.saved ? t("fleet.action.saved") : ""}
      </p>
      {operations.denied && <p role="alert">{t("fleet.write.denied")}</p>}
      <OperationDialog operations={operations} scope={scope} />
    </>
  );
}
