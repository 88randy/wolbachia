import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { ReleaseStatusPill } from "./ReleaseStatusPill";
import type { Release } from "./releases-query";

const codeColumn: DataTableColumn<Release> = {
  id: "code",
  headerKey: "releases.column.code",
  cell: (row) => row.code,
  link: (row) => ({ to: "/releases/records/$code", params: { code: row.code }, search: true }),
};

const referenceColumns: readonly DataTableColumn<Release>[] = [
  { id: "permit", headerKey: "releases.column.permit", cell: (row) => row.permit_code },
  { id: "lot", headerKey: "releases.column.lot", cell: (row) => row.lot_code },
  { id: "device", headerKey: "releases.column.device", cell: (row) => row.release_device_code },
  { id: "quadrant", headerKey: "releases.column.quadrant", cell: (row) => row.quadrant_code },
];

const statusColumn: DataTableColumn<Release> = {
  id: "status",
  headerKey: "releases.column.status",
  cell: (row) => <ReleaseStatusPill row={row} />,
};

function buildReleaseColumns(
  format: (value: string) => string,
  language: string,
): readonly DataTableColumn<Release>[] {
  const quantity = new Intl.NumberFormat(language);
  return [
    codeColumn,
    { id: "created_at", headerKey: "releases.column.when", cell: (row) => format(row.device_time) },
    ...referenceColumns,
    {
      id: "quantity",
      headerKey: "releases.column.quantity",
      align: "end",
      cell: (row) => quantity.format(Number(row.quantity)),
    },
    statusColumn,
  ];
}

/** Columns of W46: when, permit, lot, device, quadrant, quantity and status. */
export function useReleaseColumns(): readonly DataTableColumn<Release>[] {
  const format = useFormatDateTime();
  const { i18n } = useTranslation();
  return useMemo(() => buildReleaseColumns(format, i18n.language), [format, i18n.language]);
}
