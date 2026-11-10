import type { ReceptionRow } from "./reception-query";
import type { ReceptionView } from "./reception-table";
import type { ReceptionActions } from "./use-reception-command";
import { ReceptionMissingDialog } from "./ReceptionMissingDialog";
import { ReceptionIncidentLink } from "./ReceptionIncidentLink";
export function ReceptionRowActions({
  row,
  view,
  actions,
  isReady,
}: {
  row: ReceptionRow;
  view: ReceptionView;
  actions: ReceptionActions;
  isReady: boolean;
}) {
  if (row.discrepancy?.incident_id)
    return <ReceptionIncidentLink id={row.discrepancy.incident_id} />;
  return view === "expected" ? (
    <ReceptionMissingDialog row={row} actions={actions} isReady={isReady} />
  ) : null;
}
