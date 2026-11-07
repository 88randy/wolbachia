import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatDateTime } from "../format/use-format-date-time";
import { Button } from "../ui/Button";
import type { HistoryActions } from "./fleet-history-columns";
import { FleetEvidenceDownload } from "./FleetEvidenceDownload";
import { FleetFactList } from "./FleetFactList";
import { fleetClearFocusId } from "./use-fleet-dialog";
type FaultProps = { fault: Schemas["Incident"]; actions: HistoryActions };
function ClearanceAudit({ fault, actions }: FaultProps) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const proof = fault.clearance;
  if (!proof) return null;
  return (
    <details>
      <summary>{t("fleet.clear.proof")}</summary>
      <FleetFactList
        facts={[
          ["fleet.history.id", proof.id],
          ["fleet.history.created", format(proof.created_at)],
          ["fleet.clear.reviewer", proof.reviewer],
          ["fleet.clear.reason", proof.reason],
        ]}
      />
      {proof.evidence_ids.map((id) => (
        <p key={id}>
          {id}
          <FleetEvidenceDownload id={id} scope={actions.scope} />
        </p>
      ))}
    </details>
  );
}
function ClearFaultAction({ fault, actions }: FaultProps) {
  const { t } = useTranslation();
  if (fault.is_cleared || !actions.canClear) return null;
  return (
    <>
      <Button
        id={fleetClearFocusId(actions.scope.focusOwner, fault.motorcycle, fault.id)}
        aria-disabled={actions.isUnverified || !actions.state}
        onClick={() => {
          if (!actions.isUnverified && actions.state) actions.onClear(fault, actions.state);
        }}
      >
        {t("fleet.action.clearFault")}
      </Button>
      {actions.isUnverified && <p>{t("fleet.action.blocked")}</p>}
    </>
  );
}
export function FleetFaultFacts(props: FaultProps) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const { fault } = props;
  return (
    <>
      <p>{t(fault.is_cleared ? "fleet.clear.closed" : "fleet.clear.open")}</p>
      {fault.cleared_at && (
        <p>
          {t("fleet.clear.closed")}: {format(fault.cleared_at)}
        </p>
      )}
      {fault.is_cleared && !fault.clearance && (
        <p>
          {t("fleet.clear.proof")}: {t("fleet.summary.unknown")}
        </p>
      )}
      <ClearanceAudit {...props} />
      <ClearFaultAction {...props} />
    </>
  );
}
