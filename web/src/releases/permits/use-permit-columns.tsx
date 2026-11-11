import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCenterColumns } from "../../data-table/center-column";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { PermitBlockers } from "./PermitBlockers";
import { permitStatus } from "./permit-status";
import { PermitStatusBadge } from "./PermitStatusBadge";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

type Columns = DataTableColumn<Permit>[];

function identityColumns(): Columns {
  return [
    {
      id: "code",
      headerKey: "permits.column.code",
      cell: (row) => <span className={styles.code}>{row.code}</span>,
      link: (row) => ({ to: "/releases/permits/$code", params: { code: row.code }, search: true }),
    },
    {
      id: "number",
      headerKey: "permits.column.number",
      cell: (row) => row.current_version?.number ?? "",
    },
    { id: "type", headerKey: "permits.column.type", cell: (row) => row.type_name ?? "" },
    {
      id: "authority",
      headerKey: "permits.column.authority",
      cell: (row) => row.current_version?.authority ?? "",
    },
  ];
}

function validity(row: Permit, t: TFunction, format: (iso: string) => string): string {
  const version = row.current_version;
  if (!version) return "";
  return t("permits.column.validityCell", {
    from: format(version.valid_from),
    to: format(version.valid_to),
  });
}

function stateColumns(t: TFunction, format: (iso: string) => string): Columns {
  return [
    {
      id: "zone",
      headerKey: "permits.column.zone",
      cell: (row) => row.quadrant_code,
    },
    {
      id: "validity",
      headerKey: "permits.column.validity",
      cell: (row) => validity(row, t, format),
    },
    {
      id: "status",
      headerKey: "permits.column.status",
      cell: (row) => <PermitStatusBadge status={permitStatus(row.blocked_by)} />,
    },
    {
      id: "requirements",
      headerKey: "permits.column.requirements",
      cell: (row) => <PermitBlockers blockers={row.blocked_by} />,
    },
  ];
}

/** Columns of W44: number, type, authority, zone, validity, status, requirements met. */
export function usePermitColumns(): readonly DataTableColumn<Permit>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const columns = useMemo(() => [...identityColumns(), ...stateColumns(t, format)], [t, format]);
  return useCenterColumns(columns, (row) => row.center, { after: "authority" });
}
