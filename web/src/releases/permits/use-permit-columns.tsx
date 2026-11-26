import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCenterColumns } from "../../data-table/center-column";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime, useFormatValidityEnd } from "../../format/use-format-date-time";
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

interface Formats {
  format: (iso: string) => string;
  formatEnd: (iso: string) => string;
}

function validity(row: Permit, t: TFunction, formats: Formats): string {
  const version = row.current_version;
  if (!version) return "";
  return t("permits.column.validityCell", {
    from: formats.format(version.valid_from),
    to: formats.formatEnd(version.valid_to),
  });
}

function stateColumns(t: TFunction, formats: Formats): Columns {
  return [
    {
      id: "zone",
      headerKey: "permits.column.zone",
      cell: (row) => <span className="whitespace-nowrap">{row.quadrant_code}</span>,
    },
    {
      id: "validity",
      headerKey: "permits.column.validity",
      cell: (row) => validity(row, t, formats),
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
  const formatEnd = useFormatValidityEnd();
  const columns = useMemo(
    () => [...identityColumns(), ...stateColumns(t, { format, formatEnd })],
    [t, format, formatEnd],
  );
  return useCenterColumns(columns, (row) => row.center, { after: "authority" });
}
