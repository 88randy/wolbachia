import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { operationTableData } from "../../operations/read-access";
import { trainingVersionsOptions, TRAINING_PAGE_SIZE } from "./training-query";
import type { TrainingScope, Training } from "./training-query";
import { VERSION_TABLE } from "./training-table";
import { useTrainingVersionColumns } from "./training-version-columns";
const TABLE_SCOPE = { prefix: "version_" };
export function TrainingVersions({ scope, course }: { scope: TrainingScope; course: Training }) {
  const { t } = useTranslation();
  const table = useTableUrlState(VERSION_TABLE, TABLE_SCOPE);
  const query = useQuery(trainingVersionsOptions(scope, { id: course.id, page: table.state.page }));
  const columns = useTrainingVersionColumns();
  return (
    <DataTable
      embedded
      caption={t("trainings.course.versions")}
      columns={columns}
      controller={table}
      getRowId={(row) => row.id}
      data={operationTableData(query, table.state.page, TRAINING_PAGE_SIZE)}
    />
  );
}
