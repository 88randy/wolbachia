import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import type { DataTableColumn, TableQueryConfig } from "../data-table/table-types";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatCalendarDate, useFormatNumber } from "../format/use-formatters";
import { useCan } from "../session/use-can";
import { useSessionIdentity } from "../session/use-session-identity";
import { EmptyState } from "../ui/EmptyState";
import { InfoHint } from "../ui/InfoHint";
import { NewInterventionDialog } from "./NewInterventionDialog";
import { interventionTypesOptions, interventionsOptions } from "./scheduling-queries";

const PAGE_SIZE = 25;
const TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  filters: [
    {
      kind: "text",
      key: "date_from",
      labelKey: "scheduling.intervention.from",
      input: "date-from",
      dateFormat: "date",
      maxLength: 10,
    },
    {
      kind: "text",
      key: "date_to",
      labelKey: "scheduling.intervention.to",
      input: "date-to",
      dateFormat: "date",
      maxLength: 10,
    },
  ],
  sortableIds: ["date_from", "created_at"],
  supportsVoided: false,
};

type Row = Schemas["Intervention"];

/** W32: spraying, fogging or larvicide done by other institutions, so nobody repeats or contradicts it. */
export function W32Page() {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const can = useCan();
  const formatDay = useFormatCalendarDate();
  const formatNumber = useFormatNumber();
  const controller = useTableUrlState(TABLE);
  const query = useQuery(interventionsOptions(client, identity, controller.state, PAGE_SIZE));
  const types = useQuery(interventionTypesOptions(client, identity)).data ?? [];
  const canCreate = can("intervention.create");
  const isEmpty = query.isSuccess && query.data.count === 0;
  const typeName = (row: Row) => {
    const label = types.find((item) => item.id === row.type)?.label_es ?? row.type_code;
    return row.other_text ? `${label}: ${row.other_text}` : label;
  };
  const columns: readonly DataTableColumn<Row>[] = [
    { id: "type", headerKey: "scheduling.intervention.type", cell: typeName },
    { id: "product", headerKey: "scheduling.intervention.product", cell: (row) => row.product },
    { id: "source", headerKey: "scheduling.intervention.institution", cell: (row) => row.source },
    {
      id: "blocks",
      headerKey: "scheduling.intervention.blocksColumn",
      align: "end",
      cell: (row) => formatNumber(row.blocks.length),
    },
    {
      id: "date_from",
      headerKey: "scheduling.intervention.dates",
      cell: (row) =>
        t("scheduling.intervention.range", {
          from: formatDay(row.date_from),
          to: formatDay(row.date_to),
        }),
    },
  ];
  return (
    <ListPage
      title={t("scheduling.intervention.title")}
      description={
        <>
          {t("scheduling.intervention.description")}
          <InfoHint text={t("scheduling.intervention.hint")} />
        </>
      }
      actions={canCreate && <NewInterventionDialog />}
    >
      {isEmpty ? (
        <EmptyState
          kind="noData"
          message={`${t("scheduling.intervention.empty")}. ${t(canCreate ? "scheduling.intervention.emptyHelp" : "scheduling.intervention.emptyReadOnly")}`}
          action={canCreate ? <NewInterventionDialog variant="secondary" /> : undefined}
        />
      ) : (
        <>
          <FilterBar controller={controller} />
          <DataTable
            caption={t("scheduling.intervention.title")}
            columns={columns}
            controller={controller}
            getRowId={(row) => row.id}
            data={pageTableData(query, controller.state.page, PAGE_SIZE)}
          />
        </>
      )}
    </ListPage>
  );
}
