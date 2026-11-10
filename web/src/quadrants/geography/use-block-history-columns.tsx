import { EntityName } from "../../lookups/EntityName";
import type { Schemas } from "@wolbachia/api-client";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { polygonText } from "./geometry";
export function useBlockHistoryColumns(): DataTableColumn<Schemas["BlockVersion"]>[] {
  const format = useFormatDateTime();
  return [
    {
      id: "revision",
      headerKey: "geography.field.revision",
      cell: (row) => row.revision,
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
      cell: (row) => <pre>{polygonText(row.geometry)}</pre>,
    },
  ];
}
