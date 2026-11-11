import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { StatusPill } from "../../ui/StatusPill";
import { FilterBar } from "../../data-table/FilterBar";
import { DataTable } from "../../data-table/DataTable";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import type { DataTableColumn } from "../../data-table/table-types";
import { operationTableData } from "../../operations/read-access";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useInventoryContext } from "../use-inventory-context";
import { useDiscrepancyCounts } from "../use-status-counts";
import {
  DISCREPANCY_TABLE,
  DISCREPANCY_PAGE_SIZE,
  discrepancyListOptions,
} from "./discrepancy-query";
import type { Discrepancy } from "./discrepancy-query";

function useColumns(): DataTableColumn<Discrepancy>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const search = useSearch({ strict: false });
  return [
    {
      id: "code",
      headerKey: "discrepancies.field.code",
      cell: (row) => row.code,
      link: (row) => ({ to: "/inventory/discrepancies/$code", params: { code: row.code }, search }),
    },
    { id: "transfer", headerKey: "discrepancies.field.transfer", cell: (row) => row.transfer.code },
    {
      id: "status",
      headerKey: "discrepancies.field.status",
      cell: (row) => (
        <StatusPill tone={row.status === "open" ? "warning" : "success"}>
          {t(`discrepancies.status.${row.status}`)}
        </StatusPill>
      ),
    },
    {
      id: "created_at",
      headerKey: "discrepancies.field.createdAt",
      cell: (row) => format(row.created_at),
    },
  ];
}
export function DiscrepancyList() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const controller = useTableUrlState(DISCREPANCY_TABLE);
  const query = useQuery(discrepancyListOptions(scope, controller.state));
  const columns = useColumns();
  const counts = useDiscrepancyCounts();
  return (
    <ListPage title={t("discrepancies.page.title")}>
      <FilterBar controller={controller} quickCounts={counts} />
      <DataTable
        caption={t("discrepancies.page.title")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={operationTableData(query, controller.state.page, DISCREPANCY_PAGE_SIZE)}
      />
    </ListPage>
  );
}
