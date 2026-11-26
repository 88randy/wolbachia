import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { REVIEW_TABLE, reviewTableQuery } from "./review-table";
import { reviewListOptions, REVIEW_PAGE_SIZE } from "./review-query";
import type { ReviewScope } from "./review-query";
import { useReviewColumns } from "./use-review-columns";
import { operationTableData } from "../read-access";
const TABLE_SCOPE = { ignoredPrefixes: ["item"] };

export function ReviewTray({ scope }: { scope: ReviewScope }) {
  const { t } = useTranslation();
  const search = useSearch({ strict: false });
  const table = useTableUrlState(REVIEW_TABLE, TABLE_SCOPE);
  const controller = table;
  const query = useQuery(reviewListOptions(scope, reviewTableQuery(table.state)));
  const columns = useReviewColumns();
  return (
    <>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("reviews.workspace.title")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={operationTableData(query, table.state.page, REVIEW_PAGE_SIZE)}
        rowLink={(row) => ({ to: "/operations/reviews", search: { ...search, item: row.id } })}
      />
    </>
  );
}
