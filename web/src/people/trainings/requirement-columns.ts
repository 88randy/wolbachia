import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { Requirement } from "./training-query";
import { requirementPins } from "./requirement-input";
const COLUMNS: DataTableColumn<Requirement>[] = [
  { id: "action", headerKey: "trainings.field.action", cell: (row) => row.action },
  { id: "id", headerKey: "trainings.field.requirementVersion", cell: (row) => row.id },
  {
    id: "acceptable_versions",
    headerKey: "trainings.field.acceptableVersions",
    cell: (row) => requirementPins(row.acceptable_versions),
  },
];
export function useRequirementColumns(): DataTableColumn<Requirement>[] {
  const format = useFormatDateTime();
  return [
    ...COLUMNS,
    {
      id: "effective_from",
      headerKey: "trainings.field.effective",
      cell: (row) => format(row.effective_from),
    },
  ];
}
