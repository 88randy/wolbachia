import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { ListPage } from "../../components/templates/ListPage";
import type { OverflowAction } from "../../components/templates/OverflowMenu";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import type { DataTableColumn } from "../../data-table/table-types";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { buttonVariants } from "../../ui/button-variants";
import { useLocationNames } from "../use-location-names";
import { useInventoryContext } from "../use-inventory-context";
import { CancelDeliveryDialog } from "./CancelDeliveryDialog";
import { DeliveryStatusPill } from "./DeliveryStatusPill";
import { DELIVERY_TABLE } from "./allocation-table";
import {
  ALLOCATION_PAGE_SIZE,
  courierDirectoryOptions,
  deliveryCountOptions,
  deliveryListOptions,
} from "./allocation-query";
import { statusOf } from "./use-assignment-panel";
import { courierState } from "./use-assignment-route";

type Row = Schemas["SupplyAssignmentRead"];
const COUNTED = ["", "planned", "released", "received", "cancelled"] as const;

function useDeliveryCounts() {
  const scope = useInventoryContext();
  const counts = COUNTED.map(
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed list, fixed order
    (status) => useQuery(deliveryCountOptions(scope, status)).data,
  );
  if (counts.some((value) => value === undefined)) return undefined;
  return Object.fromEntries(COUNTED.map((status, index) => [status, counts[index] ?? 0]));
}

function useColumns(): DataTableColumn<Row>[] {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const formatDay = useFormatCalendarDate();
  const nameOfLocation = useLocationNames();
  const people = useQuery(courierDirectoryOptions(scope, "/inventory/assignments")).data;
  const link = (row: Row) => ({
    to: "/inventory/assignments/new" as const,
    search: { date: row.date },
    state: courierState(row.courier_id),
  });
  return [
    {
      id: "courier",
      headerKey: "allocation.delivery.col.courier",
      cell: (row) => people?.find((person) => person.id === row.courier_id)?.display_name ?? "—",
      link,
    },
    { id: "date", headerKey: "allocation.delivery.col.date", cell: (row) => formatDay(row.date) },
    {
      id: "origin",
      headerKey: "allocation.delivery.col.origin",
      cell: (row) => nameOfLocation(row.origin_id) ?? "—",
    },
    {
      id: "lines",
      headerKey: "allocation.delivery.col.lines",
      align: "end",
      cell: (row) => String(row.lines.length),
    },
    {
      id: "status",
      headerKey: "allocation.delivery.col.status",
      cell: (row) => <DeliveryStatusPill status={statusOf(row) ?? "planned"} />,
    },
    { id: "hint", headerKey: "allocation.delivery.col.next", cell: (row) => t(nextKey(row)) },
  ];
}

function nextKey(row: Row) {
  const status = statusOf(row);
  if (status === "released")
    return row.lifecycle?.signature?.state === "pending_phone"
      ? ("allocation.delivery.next.pendingPhone" as const)
      : ("allocation.delivery.next.released" as const);
  if (status === "received") return "allocation.delivery.next.received" as const;
  if (status === "cancelled") return "allocation.delivery.next.cancelled" as const;
  return "allocation.delivery.next.planned" as const;
}

/** Deliveries by day and courier, with status tabs. A row offers only what its state allows. */
export function DeliveryList() {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const navigate = useNavigate();
  const controller = useTableUrlState(DELIVERY_TABLE);
  const query = useQuery(deliveryListOptions(scope, controller.state));
  const formatDay = useFormatCalendarDate();
  const counts = useDeliveryCounts();
  const columns = useColumns();
  const [voiding, setVoiding] = useState<Row | null>(null);
  const rowMenu = (row: Row): OverflowAction[] => {
    const status = statusOf(row);
    const open = () => {
      void navigate({
        to: "/inventory/assignments/new",
        search: { date: row.date },
        state: courierState(row.courier_id),
      });
    };
    return [
      {
        id: "open",
        label: t(
          status === "planned" || status === "cancelled"
            ? "allocation.delivery.menu.edit"
            : "allocation.delivery.menu.open",
        ),
        onSelect: open,
      },
      {
        id: "cancel",
        label: t(
          status === "released"
            ? "allocation.delivery.cancel"
            : status === "received"
              ? "allocation.delivery.cancelBlocked"
              : "allocation.delivery.menu.cancelNotYet",
        ),
        destructive: true,
        disabled: status !== "released",
        onSelect: () => {
          setVoiding(row);
        },
      },
    ];
  };
  return (
    <ListPage
      title={t("allocation.assignment.title")}
      description={t("allocation.delivery.listDescription")}
      actions={
        <Link to="/inventory/assignments/new" className={buttonVariants({ variant: "primary" })}>
          <Plus aria-hidden="true" />
          {t("allocation.delivery.new")}
        </Link>
      }
    >
      <FilterBar controller={controller} quickCounts={counts} />
      <DataTable
        caption={t("allocation.assignment.title")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        rowMenu={rowMenu}
        data={pageTableData(query, controller.state.page, ALLOCATION_PAGE_SIZE)}
      />
      {voiding && (
        <CancelDeliveryDialog
          assignment={voiding}
          label={t("allocation.delivery.cancelOf", { date: formatDay(voiding.date) })}
          onClose={() => {
            setVoiding(null);
          }}
        />
      )}
    </ListPage>
  );
}
