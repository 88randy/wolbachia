import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { operationTableData } from "../../operations/read-access";
import { trainingsOptions, TRAINING_PAGE_SIZE } from "./training-query";
import type { TrainingScope, Training } from "./training-query";
import type { DataTableColumn } from "../../data-table/table-types";
import { TRAINING_TABLE, trainingTableQuery } from "./training-table";
const TABLE_SCOPE = {
  ignoredPrefixes: [
    "course",
    "requirement_",
    "version_",
    "subject",
    "person_",
    "action",
    "center",
    "quadrant",
    "at",
    "tab",
  ],
};

function useColumns(): DataTableColumn<Training>[] {
  const search = useSearch({ strict: false });
  const open = (row: Training) => ({
    to: "/people/trainings" as const,
    search: { ...search, tab: "courses", course: row.code },
  });
  return [
    { id: "code", headerKey: "trainings.field.code", cell: (row) => row.code },
    {
      id: "name",
      headerKey: "trainings.field.name",
      cell: (row) => <span className="font-semibold">{row.name}</span>,
      link: open,
    },
  ];
}

export function TrainingList({ scope }: { scope: TrainingScope }) {
  const { t } = useTranslation();
  const columns = useColumns();
  const table = useTableUrlState(TRAINING_TABLE, TABLE_SCOPE);
  const query = useQuery(trainingsOptions(scope, trainingTableQuery(table.state)));
  return (
    <>
      <FilterBar controller={table} />
      <DataTable
        caption={t("trainings.workspace.title")}
        columns={columns}
        controller={table}
        getRowId={(row) => row.id}
        data={operationTableData(query, table.state.page, TRAINING_PAGE_SIZE)}
      />
    </>
  );
}
