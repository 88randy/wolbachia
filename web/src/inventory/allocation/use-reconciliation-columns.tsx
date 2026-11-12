import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import type { DataTableColumn } from "../../data-table/table-types";
import { useLanguage } from "../../i18n/use-language";
import { formatInventoryQuantity } from "../format-inventory-quantity";
import { DifferenceCell } from "./DifferenceCell";
import { courierLabel, lotLabel } from "./allocation-labels";
import type { ReconciliationRow } from "./reconciliation-equation";
import type { CourierEntry } from "./allocation-query";

interface Directories {
  lots: readonly Schemas["Lot"][] | undefined;
  couriers: readonly CourierEntry[] | undefined;
}
type Column = DataTableColumn<ReconciliationRow>;
type Quantity = (value: string | null) => string;
type LineField = "credited" | "used" | "returned" | "shrinkage";

function lotIdOf(row: ReconciliationRow) {
  const lines = row.reconciliation.assignment.lines;
  return lines.find((line) => line.id === row.line.assignment_line_id)?.lot_id ?? "";
}

function numberColumn(id: LineField, headerKey: MessageKey, quantity: Quantity): Column {
  return {
    id,
    headerKey,
    align: "end",
    cell: (row) => quantity(row.line[id]),
  };
}

function textColumns({ lots, couriers }: Directories): Column[] {
  return [
    {
      id: "courier",
      headerKey: "allocation.reconciliation.courier",
      cell: (row) => courierLabel(couriers, row.reconciliation.assignment.courier_id),
    },
    {
      id: "supply",
      headerKey: "allocation.reconciliation.supply",
      cell: (row) => lotLabel(lots, lotIdOf(row)),
    },
  ];
}

/** Assigned links to the assignment of that courier and day; shrinkage to that day's write-offs. */
function numberColumns(quantity: Quantity, can: (permission: string) => boolean): Column[] {
  const assigned = numberColumn("credited", "allocation.reconciliation.assigned", quantity);
  const shrinkage = numberColumn("shrinkage", "allocation.reconciliation.shrinkage", quantity);
  const assignment = (row: ReconciliationRow) => row.reconciliation.assignment;
  return [
    {
      ...assigned,
      ...(can("inventory.allocate")
        ? {
            link: (row: ReconciliationRow) => ({
              to: "/inventory/assignments/new" as const,
              search: { date: assignment(row).date, courier: assignment(row).courier_id },
            }),
          }
        : {}),
    },
    numberColumn("used", "allocation.reconciliation.used", quantity),
    numberColumn("returned", "allocation.reconciliation.returned", quantity),
    {
      ...shrinkage,
      ...(can("inventory.write_off")
        ? {
            link: (row: ReconciliationRow) => ({
              to: "/inventory/write-offs" as const,
              search: { created_at_from: undefined, date: assignment(row).date },
            }),
          }
        : {}),
    },
  ];
}

export function useReconciliationColumns(directories: Directories) {
  const { t } = useTranslation();
  const can = useCan();
  const { language } = useLanguage();
  const quantity: Quantity = (value) =>
    value === null
      ? t("allocation.reconciliation.missing")
      : formatInventoryQuantity(value, language);
  const difference: Column = {
    id: "difference",
    headerKey: "allocation.reconciliation.difference",
    align: "end",
    cell: (row) => <DifferenceCell line={row.line} state={row.state} />,
  };
  return [...textColumns(directories), ...numberColumns(quantity, can), difference];
}
