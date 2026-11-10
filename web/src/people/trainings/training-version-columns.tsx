import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { TrainingVersion } from "./training-query";
import { TrainingVersionStatus } from "./TrainingVersionStatus";
function actionNames(actions: unknown): string {
  return Array.isArray(actions)
    ? actions.filter((value): value is string => typeof value === "string").join(", ")
    : "";
}
const VERSION_COLUMNS: DataTableColumn<TrainingVersion>[] = [
  { id: "id", headerKey: "trainings.field.trainingVersion", cell: (row) => row.id },
  {
    id: "validity_seconds",
    headerKey: "trainings.field.validity",
    cell: (row) => row.validity_seconds,
    align: "end",
  },
  {
    id: "enabled_actions",
    headerKey: "trainings.field.actions",
    cell: (row) => actionNames(row.enabled_actions),
  },
];
export function useTrainingVersionColumns(): DataTableColumn<TrainingVersion>[] {
  const format = useFormatDateTime();
  return [
    ...VERSION_COLUMNS,
    {
      id: "effective_from",
      headerKey: "trainings.field.effective",
      cell: (row) => format(row.effective_from),
    },
    {
      id: "is_active",
      headerKey: "trainings.field.status",
      cell: (row) => <TrainingVersionStatus isActive={row.is_active} />,
    },
  ];
}
