import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { pageTableData } from "../../data-table/table-data";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { buttonVariants } from "../../ui/button-variants";
import { useCan } from "../../session/use-can";
import { TRANSFER_TABLE } from "./transfer-table";
import { transferListOptions, TRANSFER_PAGE_SIZE } from "./transfer-query";
import type { Transfer, TransferScope } from "./transfer-query";
import { useLocationNames } from "../use-location-names";
import { TransferStatus } from "./TransferStatus";
function useColumns(): DataTableColumn<Transfer>[] {
  const format = useFormatDateTime();
  const { t } = useTranslation();
  const nameOf = useLocationNames();
  return [
    {
      id: "code",
      headerKey: "transfers.field.code",
      cell: (row) => row.code,
      link: (row) => ({ to: "/inventory/transfers/$code", params: { code: row.code } }),
    },
    {
      id: "route",
      headerKey: "transfers.field.route",
      cell: (row) =>
        `${nameOf(row.origin_id) ?? t("inventory.state.unconfigured")} → ${nameOf(row.destination_id) ?? t("inventory.state.unconfigured")}`,
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
  const canCreate = useCan()("transfer.create");
  return (
    <ListPage
      title={t("transfers.page.title")}
      actions={
        canCreate && (
          <Link to="/inventory/transfers/new" className={buttonVariants({ variant: "primary" })}>
            <Plus aria-hidden="true" />
            {t("transfers.new.action")}
          </Link>
        )
      }
    >
      <FilterBar controller={controller} />
      <DataTable
        caption={t("transfers.page.title")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={pageTableData(query, controller.state.page, TRANSFER_PAGE_SIZE)}
      />
    </ListPage>
  );
}
