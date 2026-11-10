import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { useSessionIdentity } from "../../session/use-session-identity";
import { ReconciliationActions } from "./ReconciliationActions";
import { useReconciliationColumns } from "./use-reconciliation-columns";
import type { useReconciliationView } from "./use-reconciliation-view";
import type { ReconciliationRow } from "./reconciliation-equation";

export function ReconciliationTable({
  view,
  onJustify,
}: {
  view: ReturnType<typeof useReconciliationView>;
  onJustify: (row: ReconciliationRow) => void;
}) {
  const { t } = useTranslation();
  const identity = useSessionIdentity();
  const columns = useReconciliationColumns(view);
  const canJustify = identity.permissions?.includes("inventory.reconcile") === true;
  return (
    <DataTable
      caption={t("allocation.reconciliation.tableCaption")}
      columns={columns}
      controller={view.controller}
      getRowId={(row) => row.key}
      data={view.data}
      rowActions={(row) => (
        <ReconciliationActions row={row} canJustify={canJustify} onJustify={onJustify} />
      )}
      embedded
    />
  );
}
