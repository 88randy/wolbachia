import { useCenterName } from "../lookups/use-reference-names";
import { useShowCenter } from "../lookups/use-center-scope";
import styles from "./fleet.module.css";
import type { DataTableColumn } from "../data-table/table-types";
import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Motorcycle } from "./fleet-query";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
import { useFormatDateTime } from "../format/use-format-date-time";
/** Carry the list address so returning from any tab restores the view. */
function useIdentityColumns(): DataTableColumn<Motorcycle>[] {
  const { t } = useTranslation();
  const search = useSearch({ strict: false });
  return [
    {
      id: "code",
      headerKey: "fleet.column.code",
      cell: (item) => <span className={styles.code}>{item.code}</span>,
      link: (item) => ({ to: "/fleet/motorcycles/$code", params: { code: item.code }, search }),
    },
    {
      id: "plate",
      headerKey: "fleet.column.plate",
      cell: (item) => (
        <span className={styles.code}>{item.plate || t("fleet.summary.unknown")}</span>
      ),
    },
  ];
}
function createdAtColumn(format: (date: string) => string): DataTableColumn<Motorcycle> {
  return {
    id: "created_at",
    headerKey: "fleet.summary.createdAt",
    cell: (item) => format(item.created_at),
  };
}
export function useFleetColumns(): readonly DataTableColumn<Motorcycle>[] {
  const search = useSearch({ strict: false });
  const format = useFormatDateTime();
  const identity = useIdentityColumns();
  const centerName = useCenterName();
  const showCenter = useShowCenter();
  const columns = [
    ...identity,
    {
      id: "status",
      headerKey: "fleet.column.status",
      cell: (item) => <MotorcycleStatusBadge motorcycle={item} />,
    },
    {
      id: "center",
      headerKey: "geography.field.center",
      cell: (item) => centerName(item.center),
      link: (item) =>
        item.center
          ? {
              to: "/fleet/motorcycles",
              search: { ...search, center: item.center, page: undefined },
            }
          : undefined,
    },
    createdAtColumn(format),
  ];
  return showCenter ? columns : columns.filter((column) => column.id !== "center");
}
