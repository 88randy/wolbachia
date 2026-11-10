import { EntityName } from "../../lookups/EntityName";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useTranslation } from "react-i18next";
import { nameOrDash } from "../../lookups/use-reference-names";
import { RelocationStatus } from "./RelocationStatus";
import type { DataTableColumn } from "../../data-table/table-types";
import type { Relocation } from "./relocations-query";
import { relocationReasonLabel } from "./relocation-snapshot";
export function useRelocationColumns(): DataTableColumn<Relocation>[] {
  const format = useFormatDateTime();
  const { i18n } = useTranslation();
  return [
    {
      id: "ovitrap__sampling_point__code",
      headerKey: "relocations.workspace.point",
      cell: (row) => row.point_code,
      link: (row) => ({ to: ".", search: (previous) => ({ ...previous, relocation: row.code }) }),
    },
    {
      id: "reason",
      headerKey: "relocations.workspace.reason",
      cell: (row) => relocationReasonLabel(row.reason_label, i18n.language) || row.reason_code,
    },
    {
      id: "author",
      headerKey: "relocations.workspace.author",
      cell: (row) => nameOrDash(row.created_by_name),
    },
    {
      id: "created_at",
      headerKey: "relocations.workspace.createdAt",
      cell: (row) => format(row.created_at),
    },
    {
      id: "status",
      headerKey: "relocations.workspace.status",
      cell: (row) => <RelocationStatus status={row.status} />,
    },
  ];
}
