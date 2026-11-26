import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { ResolutionHistory } from "./ResolutionHistory";
export function useHistoryColumns(
  pointCode: (id: string) => string,
): DataTableColumn<Schemas["QuadrantVersion"]>[] {
  const { t } = useTranslation();
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
      cell: (row) => row.created_by_name ?? t("geography.status.unknown"),
    },
    {
      id: "geometry",
      headerKey: "geography.field.geometry",
      cell: (row) => <ResolutionHistory version={row} pointCode={pointCode} />,
    },
  ];
}
