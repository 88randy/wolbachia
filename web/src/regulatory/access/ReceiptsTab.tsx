/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useFormatCalendarDate, useFormatNumber } from "../../format/use-formatters";
import { RECEIPT_TABLE, receiptOptions } from "../reg-queries";
import type { ExportReceiptRow } from "../reg-queries";
import { FilterBar } from "../../data-table/FilterBar";
import { useRegList } from "../use-reg-list";

/** Receipts of the official exports: who downloaded what and for which period. */
export function ReceiptsTab() {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const formatDay = useFormatCalendarDate();
  const formatNumber = useFormatNumber();
  const { controller, data } = useRegList(RECEIPT_TABLE, receiptOptions);
  const columns: DataTableColumn<ExportReceiptRow>[] = [
    {
      id: "when",
      headerKey: "regulatory.access.col.when",
      cell: (row) => formatDateTime(row.created_at),
    },
    {
      id: "who",
      headerKey: "regulatory.access.col.who",
      cell: (row) => row.actor_name ?? t("regulatory.access.system"),
    },
    {
      id: "dataset",
      headerKey: "regulatory.access.col.dataset",
      cell: (row) => t(`regulatory.exports.dataset.${row.dataset as "releases"}`),
    },
    {
      id: "period",
      headerKey: "regulatory.access.col.period",
      cell: (row) => `${formatDay(row.date_from)} – ${formatDay(row.date_to)}`,
    },
    {
      id: "recipient",
      headerKey: "regulatory.access.col.recipient",
      cell: (row) => row.recipient_institution || t("regulatory.common.none"),
    },
    {
      id: "rows",
      headerKey: "regulatory.access.col.rows",
      align: "end",
      cell: (row) => formatNumber(row.row_count),
    },
    {
      id: "rfc",
      headerKey: "regulatory.access.col.rfc",
      align: "end",
      cell: (row) => formatNumber(row.rfc_rows_released),
    },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FilterBar controller={controller} />
      <DataTable
        caption={t("regulatory.access.tab.exports")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={data}
      />
    </div>
  );
}
