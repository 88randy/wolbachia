import { Link, useSearch } from "@tanstack/react-router";
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
  ],
};
const COLUMNS: DataTableColumn<Training>[] = [
  { id: "code", headerKey: "trainings.field.code", cell: (row) => row.code },
  { id: "name", headerKey: "trainings.field.name", cell: (row) => row.name },
];
export function TrainingList({ scope }: { scope: TrainingScope }) {
  const { t } = useTranslation();
  const search = useSearch({ strict: false });
  const table = useTableUrlState(TRAINING_TABLE, TABLE_SCOPE);
  const query = useQuery(trainingsOptions(scope, trainingTableQuery(table.state)));
  return (
    <>
      <FilterBar controller={table} />
      <DataTable
        caption={t("trainings.workspace.title")}
        columns={COLUMNS}
        controller={table}
        getRowId={(row) => row.id}
        data={operationTableData(query, table.state.page, TRAINING_PAGE_SIZE)}
        rowActions={(row) => (
          <Link to="/people/trainings" search={{ ...search, course: row.code }}>
            {t("trainings.course.open")} {row.name}
          </Link>
        )}
      />
    </>
  );
}
