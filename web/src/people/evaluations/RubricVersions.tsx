import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import type { DataTableColumn } from "../../data-table/table-types";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { operationTableData } from "../../operations/read-access";
import { RubricVersionContent } from "./RubricVersionContent";
import { RUBRIC_TABLE, RUBRIC_SCOPE } from "./rubric-table";
import { rubricVersionsOptions, PAGE_SIZE } from "./evaluation-query";
import type { EvaluationScope, RubricVersion } from "./evaluation-query";
interface Props {
  scope: EvaluationScope;
  id: string;
  onSelect?: (version: RubricVersion) => void;
}
export function RubricVersions({ scope, id, onSelect }: Props) {
  const { t } = useTranslation();
  const table = useTableUrlState(RUBRIC_TABLE, RUBRIC_SCOPE);
  const query = useQuery(rubricVersionsOptions(scope, { id, page: table.state.page }));
  const isBlocked = query.isPlaceholderData || query.isFetching || !!query.error;
  const entries = operationTableData(query, table.state.page, PAGE_SIZE);
  const columns: DataTableColumn<RubricVersion>[] = [
    {
      id: "version",
      headerKey: "evaluations.rubric.version",
      cell: (version) => (
        <RubricVersionContent version={version} onSelect={onSelect} isBlocked={isBlocked} />
      ),
    },
  ];
  return (
    <DataTable
      embedded
      caption={t("evaluations.rubric.versionHistory")}
      columns={columns}
      controller={table}
      data={entries}
      getRowId={(version) => version.id}
    />
  );
}
