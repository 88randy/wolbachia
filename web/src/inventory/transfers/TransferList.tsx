import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { pageTableData } from "../../data-table/table-data";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { TRANSFER_TABLE } from "./transfer-table";
import { transferListOptions, TRANSFER_PAGE_SIZE } from "./transfer-query";
import type { Transfer, TransferScope } from "./transfer-query";
import { TransferStatus } from "./TransferStatus";
import styles from "../inventory.module.css";
function useColumns(): DataTableColumn<Transfer>[] {
  const format = useFormatDateTime();
  return [
    {
      id: "code",
      headerKey: "transfers.field.code",
      cell: (row) => row.code,
      link: (row) => ({ to: "/inventory/transfers/$code", params: { code: row.code } }),
    },
    {
      id: "state",
      headerKey: "inventory.field.status",
      cell: (row) => <TransferStatus state={row.state} />,
    },
    {
      id: "created_at",
      headerKey: "inventory.field.createdAt",
      cell: (row) => format(row.created_at),
    },
  ];
}
export function TransferList({ scope }: { scope: TransferScope }) {
  const { t } = useTranslation();
  const controller = useTableUrlState(TRANSFER_TABLE);
  const query = useQuery(transferListOptions(scope, controller.state));
  const columns = useColumns();
  return (
    <Card title={t("transfers.page.title")} headingLevel={1}>
      <div className={styles.filters}>
        <FilterBar controller={controller} />
      </div>
      <DataTable
        caption={t("transfers.page.title")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={pageTableData(query, controller.state.page, TRANSFER_PAGE_SIZE)}
        embedded
      />
    </Card>
  );
}
