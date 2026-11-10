import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { ReleaseStatusPill } from "./ReleaseStatusPill";
import type { Release } from "./releases-query";

/** Columns of W46: when, permit, lot, device, quadrant, quantity and status. */
export function useReleaseColumns(): readonly DataTableColumn<Release>[] {
  const format = useFormatDateTime();
  const { i18n } = useTranslation();
  return useMemo(
    () => [
      {
        id: "created_at",
        headerKey: "releases.column.when",
        cell: (row) => format(row.device_time),
        link: (row) => ({ to: "/releases/records/$id", params: { id: row.id }, search: true }),
      },
      { id: "permit", headerKey: "releases.column.permit", cell: (row) => row.permit_code },
      { id: "lot", headerKey: "releases.column.lot", cell: (row) => row.lot_code },
      { id: "device", headerKey: "releases.column.device", cell: (row) => row.release_device_code },
      { id: "quadrant", headerKey: "releases.column.quadrant", cell: (row) => row.quadrant_code },
      {
        id: "quantity",
        headerKey: "releases.column.quantity",
        align: "end",
        cell: (row) => new Intl.NumberFormat(i18n.language).format(Number(row.quantity)),
      },
      {
        id: "status",
        headerKey: "releases.column.status",
        cell: (row) => <ReleaseStatusPill row={row} />,
      },
    ],
    [format, i18n.language],
  );
}
