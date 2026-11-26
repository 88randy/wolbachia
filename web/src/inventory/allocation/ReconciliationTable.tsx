import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { OverflowAction } from "../../components/templates/OverflowMenu";
import { DataTable } from "../../data-table/DataTable";
import { useCan } from "../../session/use-can";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useReconciliationColumns } from "./use-reconciliation-columns";
import type { useReconciliationView } from "./use-reconciliation-view";
import type { ReconciliationRow } from "./reconciliation-equation";
import { courierState } from "./use-assignment-route";

/** Each line shows delivered, used, returned and the difference; its ⋯ menu offers what is allowed. */
export function ReconciliationTable({
  view,
  onJustify,
}: {
  view: ReturnType<typeof useReconciliationView>;
  onJustify: (row: ReconciliationRow) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const identity = useSessionIdentity();
  const can = useCan();
  const columns = useReconciliationColumns(view);
  const canJustify = identity.permissions?.includes("inventory.reconcile") === true;
  const rowMenu = (row: ReconciliationRow): OverflowAction[] => {
    const hasDifference = row.state === "difference";
    const actions: (OverflowAction | false)[] = [
      {
        id: "justify",
        label: t(
          !hasDifference
            ? "allocation.reconciliation.menu.balanced"
            : canJustify
              ? "allocation.reconciliation.justify"
              : "allocation.reconciliation.menu.noPermission",
        ),
        disabled: !hasDifference || !canJustify,
        onSelect: () => {
          onJustify(row);
        },
      },
      can("inventory.allocate") && {
        id: "delivery",
        label: t("allocation.reconciliation.menu.seeDelivery"),
        onSelect: () => {
          const assignment = row.reconciliation.assignment;
          void navigate({
            to: "/inventory/assignments/new",
            search: { date: assignment.date },
            state: courierState(assignment.courier_id),
          });
        },
      },
      can("discrepancy.read") && {
        id: "differences",
        label: t("allocation.reconciliation.openDiscrepancy"),
        disabled: !hasDifference,
        onSelect: () => {
          void navigate({ to: "/inventory/discrepancies" });
        },
      },
    ];
    return actions.filter((action): action is OverflowAction => action !== false);
  };
  return (
    <DataTable
      caption={t("allocation.reconciliation.tableCaption")}
      columns={columns}
      controller={view.controller}
      getRowId={(row) => row.key}
      data={view.data}
      rowMenu={rowMenu}
    />
  );
}
