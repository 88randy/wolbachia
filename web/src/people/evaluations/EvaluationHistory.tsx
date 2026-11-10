import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { operationTableData } from "../../operations/read-access";
import { evaluationsOptions, PAGE_SIZE } from "./evaluation-query";
import type { EvaluationScope } from "./evaluation-query";
import { EVALUATION_TABLE, EVALUATION_TABLE_SCOPE, evaluationQuery } from "./evaluation-table";
import { useEvaluationColumns } from "./use-evaluation-columns";
import { useEvaluationVoid } from "./use-evaluation-void";
export function EvaluationHistory({ scope }: { scope: EvaluationScope }) {
  const { t } = useTranslation();
  const table = useTableUrlState(EVALUATION_TABLE, EVALUATION_TABLE_SCOPE);
  const query = useQuery(
    evaluationsOptions(scope, evaluationQuery(table.state, scope.identity.activeCenter)),
  );
  const columns = useEvaluationColumns();
  const voidOf = useEvaluationVoid();
  const entries = operationTableData(query, table.state.page, PAGE_SIZE);
  return (
    <section aria-label={t("evaluations.history.title")}>
      <FilterBar controller={table} />
      <DataTable
        caption={t("evaluations.history.records")}
        columns={columns}
        controller={table}
        getRowId={(row) => row.id}
        data={entries}
        voidOf={voidOf}
      />
    </section>
  );
}
