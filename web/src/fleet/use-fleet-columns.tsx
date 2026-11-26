import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCenterColumns } from "../data-table/center-column";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import type { Motorcycle } from "./fleet-query";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";

/** Code and plate read as plain text; the row opens the record and the code is its link. */
export function useFleetColumns(): readonly DataTableColumn<Motorcycle>[] {
  const { t } = useTranslation();
  const search = useSearch({ strict: false });
  const format = useFormatDateTime();
  const columns: DataTableColumn<Motorcycle>[] = [
    {
      id: "code",
      headerKey: "fleet.column.code",
      cell: (item) => <span className="font-semibold">{item.code}</span>,
      link: (item) => ({ to: "/fleet/motorcycles/$code", params: { code: item.code }, search }),
    },
    {
      id: "plate",
      headerKey: "fleet.column.plate",
      cell: (item) => item.plate || t("fleet.summary.unknown"),
    },
    {
      id: "status",
      headerKey: "fleet.column.status",
      cell: (item) => <MotorcycleStatusBadge motorcycle={item} />,
    },
    {
      id: "created_at",
      headerKey: "fleet.summary.createdAt",
      cell: (item) => format(item.created_at),
    },
  ];
  return useCenterColumns(columns, (item) => item.center, { after: "status" });
}
