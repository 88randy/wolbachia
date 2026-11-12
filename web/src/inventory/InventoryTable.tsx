import { useCenterColumns } from "../data-table/center-column";
import { DataTable } from "../data-table/DataTable";
import type { TableController, TableData } from "../data-table/table-types";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
import { useInventoryColumns } from "./use-inventory-columns";
import { useInventoryLabels } from "./use-inventory-labels";

interface InventoryTableProps {
  kind: InventoryKind;
  title: string;
  controller: TableController;
  data: TableData<InventoryRecord>;
}

/** The server table of an inventory list; lots and locations can be ticked to print labels. */
export function InventoryTable({ kind, title, controller, data }: InventoryTableProps) {
  const base = useInventoryColumns(kind);
  const withCenter = useCenterColumns(base, (row) => ("center" in row ? row.center : null), {
    after: "name",
  });
  const labels = useInventoryLabels();
  return (
    <DataTable<InventoryRecord>
      caption={title}
      columns={kind === "supplies" ? base : withCenter}
      getRowId={(row) => row.id}
      controller={controller}
      selection={kind === "supplies" ? undefined : labels.selection}
      data={data}
    />
  );
}
