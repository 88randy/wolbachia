import type { DataTableColumn } from "../data-table/table-types";
import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Motorcycle } from "./fleet-query";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
/** Carry the list address so returning from any tab restores the view. */
export function useFleetColumns(): readonly DataTableColumn<Motorcycle>[] {
  const { t } = useTranslation();
  const search = useSearch({ strict: false });
  return [
    {
      id: "code",
      headerKey: "fleet.column.code",
      cell: (item) => item.code,
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
  ];
}
