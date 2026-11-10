import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import type { TableQueryConfig } from "../../data-table/table-types";
import { Pager } from "../../data-table/Pager";
import { ErrorState } from "../../ui/ErrorState";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { EmptyState } from "../../ui/EmptyState";
import { TypeHistoryRows } from "./TypeHistoryRows";
import { TYPE_PAGE_SIZE, typeHistoryOptions } from "./incident-types-query";
import type { IncidentType, TypeScope } from "./incident-types-query";
import styles from "./incident-types.module.css";
const TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: TYPE_PAGE_SIZE,
  filters: [],
  sortableIds: [],
  supportsVoided: false,
};
const URL_SCOPE = { prefix: "history_" };
export function TypeHistoryContent({ scope, item }: { scope: TypeScope; item: IncidentType }) {
  const { t } = useTranslation();
  const controller = useTableUrlState(TABLE, URL_SCOPE);
  const query = useQuery(typeHistoryOptions(scope, { id: item.id, page: controller.state.page }));
  const retry = () => {
    void query.refetch();
  };
  if (query.error && !query.data) return <ErrorState onRetry={retry} />;
  if (!query.data) return <CardSkeleton />;
  if (!query.data.results.length)
    return <EmptyState kind="noData" message={t("incidentTypes.history.empty")} />;
  const paging = {
    mode: "page" as const,
    page: controller.state.page,
    pageSize: TYPE_PAGE_SIZE,
    count: query.data.count,
  };
  return (
    <div className={styles.history}>
      {query.error && <ErrorState onRetry={retry} />}
      <TypeHistoryRows versions={query.data.results} />
      <Pager paging={paging} controller={controller} />
    </div>
  );
}
