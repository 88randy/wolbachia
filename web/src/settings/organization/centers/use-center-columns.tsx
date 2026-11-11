import type { LinkProps } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import type { DataTableColumn } from "../../../data-table/table-types";
import { useFormatDateTime } from "../../../format/use-format-date-time";
import { useFormatNumber } from "../../../format/use-formatters";
import type { CenterRow } from "./centers-api";
import { CenterStatusPill } from "./CenterStatusPill";

type CountField = "quadrant_count" | "warehouse_count" | "motorcycle_count";

const COUNTS: readonly {
  id: string;
  headerKey: MessageKey;
  field: CountField;
  to: LinkProps["to"];
}[] = [
  {
    id: "quadrants",
    headerKey: "centersAdmin.col.quadrants",
    field: "quadrant_count",
    to: "/operations/quadrants",
  },
  {
    id: "warehouses",
    headerKey: "centersAdmin.col.warehouses",
    field: "warehouse_count",
    to: "/inventory/locations",
  },
  {
    id: "motorcycles",
    headerKey: "centersAdmin.col.motorcycles",
    field: "motorcycle_count",
    to: "/fleet/motorcycles",
  },
];

const FIXED: DataTableColumn<CenterRow>[] = [
  {
    id: "name",
    headerKey: "centersAdmin.col.name",
    cell: (row) => <span className="font-semibold">{row.name}</span>,
  },
  { id: "code", headerKey: "centersAdmin.col.code", cell: (row) => row.code },
  {
    id: "status",
    headerKey: "centersAdmin.col.status",
    cell: (row) => <CenterStatusPill isActive={row.is_active} />,
  },
];

/** Name, code, status, what the center holds (each count links to its filtered list), update. */
export function useCenterColumns(): DataTableColumn<CenterRow>[] {
  const formatDateTime = useFormatDateTime();
  const formatNumber = useFormatNumber();
  const counts = COUNTS.map((count): DataTableColumn<CenterRow> => ({
    id: count.id,
    headerKey: count.headerKey,
    align: "end",
    cell: (row) => formatNumber(row[count.field]),
    link: (row) => ({ to: count.to, search: { center: row.id } }),
  }));
  return [
    ...FIXED,
    ...counts,
    {
      id: "updated_at",
      headerKey: "centersAdmin.col.updated",
      cell: (row) => formatDateTime(row.updated_at),
    },
  ];
}
