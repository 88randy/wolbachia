import { EntityName } from "../../lookups/EntityName";
import type { Schemas } from "@wolbachia/api-client";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { ResolutionHistory } from "./ResolutionHistory";
export function useHistoryColumns(): DataTableColumn<Schemas["QuadrantVersion"]>[] {
  const format = useFormatDateTime();
  return [
    {
      id: "revision",
      headerKey: "geography.field.revision",
      cell: (row) => <a href={"#version-" + row.id}>{row.revision}</a>,
      align: "end",
    },
    {
      id: "effective_from",
      headerKey: "geography.field.effective",
      cell: (row) => format(row.effective_from),
    },
    {
      id: "created_by",
      headerKey: "geography.field.author",
      cell: (row) => <EntityName kind="user" id={row.created_by} />,
    },
    {
      id: "geometry",
      headerKey: "geography.field.geometry",
      cell: (row) => <ResolutionHistory version={row} />,
    },
  ];
}
