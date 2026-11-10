import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import type { DataTableColumn } from "../../data-table/table-types";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { operationTableData } from "../../operations/read-access";
import { InlineNotice } from "../../ui/InlineNotice";
import { NoticePolicyFacts } from "./NoticePolicyFacts";
import { noticePoliciesOptions } from "./notice-query";
import type { NoticePolicy } from "./notice-query";
import { NOTICE_TABLE, NOTICE_SCOPE, noticeQuery } from "./notice-table";
import { PAGE_SIZE } from "./evaluation-query";
import type { EvaluationScope } from "./evaluation-query";
const NOTICE_COLUMNS: DataTableColumn<NoticePolicy>[] = [
  {
    id: "id",
    headerKey: "evaluations.notice.policies",
    cell: (policy) => <NoticePolicyFacts policy={policy} />,
  },
];
export function EvaluationNoticePolicies({ scope }: { scope: EvaluationScope }) {
  const { t } = useTranslation();
  const table = useTableUrlState(NOTICE_TABLE, NOTICE_SCOPE);
  const query = useQuery(
    noticePoliciesOptions(scope, noticeQuery(table.state, scope.identity.activeCenter)),
  );
  const entries = operationTableData(query, table.state.page, PAGE_SIZE);
  const isMissing =
    query.isSuccess && !query.isPlaceholderData && !query.isFetching && query.data.count === 0;
  return (
    <>
      <p>{t("evaluations.notice.historyHint")}</p>
      <FilterBar controller={table} />
      {isMissing && (
        <InlineNotice tone="warning">{t("evaluations.notice.unconfigured")}</InlineNotice>
      )}
      <DataTable
        embedded
        caption={t("evaluations.notice.policies")}
        columns={NOTICE_COLUMNS}
        controller={table}
        getRowId={(row) => row.id}
        data={entries}
      />
    </>
  );
}
