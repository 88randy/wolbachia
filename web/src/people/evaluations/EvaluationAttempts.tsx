import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { DataTableColumn } from "../../data-table/table-types";
import { DataTable } from "../../data-table/DataTable";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { operationTableData } from "../../operations/read-access";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { AttemptFacts } from "./AttemptFacts";
import { attemptsOptions, PAGE_SIZE } from "./evaluation-query";
import type { EvaluationScope } from "./evaluation-query";
import { RUBRIC_TABLE } from "./rubric-table";
const ATTEMPT_SCOPE = {
  prefix: "attempt_",
  ignoredPrefixes: [
    "item",
    "rubric_",
    "subject",
    "center",
    "quadrant",
    "page",
    "ordering",
    "include_voided",
  ],
};
const ATTEMPT_COLUMNS: DataTableColumn<Schemas["EvaluationAttemptRead"]>[] = [
  { id: "revision", headerKey: "evaluations.history.revision", cell: (row) => row.revision },
  {
    id: "observation",
    headerKey: "evaluations.history.raw",
    cell: (row) => <AttemptFacts attempt={row} />,
  },
];
export function EvaluationAttempts({ scope, id }: { scope: EvaluationScope; id: string }) {
  const { t } = useTranslation();
  const table = useTableUrlState(RUBRIC_TABLE, ATTEMPT_SCOPE);
  const query = useQuery(attemptsOptions(scope, { id, page: table.state.page }));
  const results = { ...query, data: query.isPlaceholderData ? undefined : query.data };
  const entries = operationTableData(results, table.state.page, PAGE_SIZE);
  return (
    <Card title={t("evaluations.history.attempts")}>
      <p>{id}</p>
      <InlineNotice tone="info">{t("evaluations.history.provenanceGap")}</InlineNotice>
      <DataTable
        embedded
        caption={t("evaluations.history.attemptTable")}
        controller={table}
        getRowId={(row) => row.id}
        data={entries}
        columns={ATTEMPT_COLUMNS}
      />
    </Card>
  );
}
