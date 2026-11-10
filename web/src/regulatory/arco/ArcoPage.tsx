import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { DataTable } from "../../data-table/DataTable";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { useCan } from "../../session/use-can";
import { StatusPill } from "../../ui/StatusPill";
import type { Tone } from "../../ui/tone";
import { ARCO_TABLE, arcoOptions } from "../reg-queries";
import type { ArcoRow } from "../reg-queries";
import { ListToolbar } from "../toolbar/ListToolbar";
import { useRegList } from "../use-reg-list";
import { ArcoCreateDialog } from "./ArcoCreateDialog";
import { ArcoDeadline } from "./ArcoDeadline";
import { ArcoRowActions } from "./ArcoRowActions";
import { ARCO_STATUSES, ARCO_TYPES } from "./arco-types";

const STATUS_TONES: Readonly<Record<string, Tone>> = {
  received: "info",
  in_progress: "warning",
  resolved: "success",
  rejected: "neutral",
};

/** W58: register, track and resolve ARCO requests. */
export function ArcoPage() {
  const { t } = useTranslation();
  const can = useCan();
  const formatDay = useFormatCalendarDate();
  const { controller, data } = useRegList(ARCO_TABLE, arcoOptions);
  const canManage = can("arco_request.manage");
  const columns: DataTableColumn<ArcoRow>[] = [
    {
      id: "type",
      headerKey: "regulatory.arco.col.type",
      cell: (row) => t(`regulatory.arco.type.${row.request_type as "access"}`),
    },
    {
      id: "requester",
      headerKey: "regulatory.arco.col.requester",
      cell: (row) => (
        <span className="flex flex-col">
          <strong>{row.requester_reference}</strong>
          {row.resolution_note && (
            <span className="text-xs text-ink-2">
              {t("regulatory.arco.resolutionNote", { note: row.resolution_note })}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "received",
      headerKey: "regulatory.arco.col.received",
      cell: (row) => formatDay(row.received_on),
    },
    {
      id: "due",
      headerKey: "regulatory.arco.col.due",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1.5">
          <span>{formatDay(row.due_on)}</span>
          <ArcoDeadline remainingDays={row.remaining_days} />
        </span>
      ),
    },
    {
      id: "owner",
      headerKey: "regulatory.arco.col.owner",
      cell: (row) => row.owner_name ?? t("regulatory.arco.noOwner"),
    },
    {
      id: "status",
      headerKey: "regulatory.arco.col.status",
      cell: (row) => (
        <StatusPill tone={STATUS_TONES[row.status] ?? "neutral"}>
          {t(`regulatory.arco.status.${row.status as "received"}`)}
        </StatusPill>
      ),
    },
  ];
  return (
    <ListPage title={t("regulatory.arco.title")} description={t("regulatory.arco.description")}>
      <ListToolbar
        controller={controller}
        search={{ key: "search", label: t("regulatory.arco.searchLabel") }}
        segments={{
          key: "status",
          label: t("regulatory.arco.statusLabel"),
          options: ARCO_STATUSES.map((value) => ({
            value,
            label: t(`regulatory.arco.status.${value}`),
          })),
        }}
        selects={[
          {
            key: "request_type",
            label: t("regulatory.arco.typeLabel"),
            options: ARCO_TYPES.map((value) => ({
              value,
              label: t(`regulatory.arco.type.${value}`),
            })),
          },
        ]}
        actions={canManage ? <ArcoCreateDialog /> : undefined}
      />
      <DataTable
        caption={t("regulatory.arco.title")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={data}
        rowActions={canManage ? (row) => <ArcoRowActions row={row} /> : undefined}
      />
    </ListPage>
  );
}
