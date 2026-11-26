import { useTranslation } from "react-i18next";
import { nameOrDash } from "../lookups/use-reference-names";
import { useCouriers } from "../scheduling/use-directories";
import type { MessageKey } from "@wolbachia/i18n";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import { FleetEfficiency } from "./FleetEfficiency";
import { FleetProvenance } from "./FleetProvenance";
import { FleetFuelFacts } from "./FleetFuelFacts";
import { FleetSourceLink } from "./FleetSourceLink";
import type { HistoryRow } from "./fleet-history-query";
import type { HistoryTab } from "./fleet-history-table";
import { Button } from "../ui/Button";
import type { Schemas } from "@wolbachia/api-client";
import { FleetFaultFacts } from "./FleetFaultFacts";
import type { FleetRecordScope } from "./use-fleet-scope";
import type { TableState } from "../data-table/table-types";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useSearch } from "@tanstack/react-router";
import { HISTORY_PREFIX } from "./fleet-history-table";
import styles from "./fleet.module.css";
type Column = DataTableColumn<HistoryRow>;
const NUMBER_COLUMNS = new Set(["odometer_km", "interval_km", "interval_days", "litres", "amount"]);
export interface HistoryActions {
  canManage: boolean;
  canClear: boolean;
  isUnverified: boolean;
  scope: FleetRecordScope;
  onVoid: (row: Schemas["ServiceRecord"] | Schemas["ResponsibilityLetter"]) => void;
  state?: TableState;
  onClear: (row: Schemas["Incident"], state: TableState) => void;
}
function scalar(
  id: string,
  headerKey: MessageKey,
  read: (row: HistoryRow) => string | number | null,
): Column {
  return { id, headerKey, align: NUMBER_COLUMNS.has(id) ? "end" : "start", cell: read };
}
function serviceColumns(format: (date: string) => string): Column[] {
  return [
    scalar("performed_at", "fleet.service.date", (row) =>
      "performed_at" in row ? format(row.performed_at) : null,
    ),
    scalar("odometer_km", "fleet.service.odometer", (row) =>
      "odometer_km" in row ? row.odometer_km : null,
    ),
    scalar("interval_km", "fleet.service.intervalKm", (row) =>
      "service_interval_km" in row ? row.service_interval_km : null,
    ),
    scalar("interval_days", "fleet.service.intervalDays", (row) =>
      "service_interval_days" in row ? row.service_interval_days : null,
    ),
    {
      id: "provenance",
      headerKey: "fleet.history.provenance",
      cell: (row) =>
        "due_metric_provenance" in row ? (
          <FleetProvenance value={row.due_metric_provenance} />
        ) : null,
    },
  ];
}
function letterColumns(
  format: (date: string) => string,
  courierName: (id: string | null) => string,
): Column[] {
  return [
    scalar("issued_at", "fleet.letter.date", (row) =>
      "issued_at" in row ? format(row.issued_at) : null,
    ),
    scalar("courier", "fleet.history.courier", (row) =>
      "courier" in row ? courierName(row.courier) : null,
    ),
    scalar("document", "fleet.history.opaqueDocument", (row) =>
      "document_reference" in row ? row.document_reference : null,
    ),
  ];
}
function fuelColumns(code: string, format: (date: string) => string): Column[] {
  return [
    scalar("litres", "fleet.fuel.litres", (row) => ("litres" in row ? row.litres : null)),
    scalar("amount", "fleet.fuel.amount", (row) =>
      "amount" in row ? `${row.amount} ${row.currency}` : null,
    ),
    scalar("odometer_km", "fleet.service.odometer", (row) =>
      "odometer_km" in row ? row.odometer_km : null,
    ),
    {
      id: "efficiency_km_l",
      headerKey: "fleet.fuel.comparison",
      align: "end",
      cell: (row) => ("litres" in row ? <FleetEfficiency load={row} code={code} /> : null),
    },
    scalar("event__device_time", "fleet.fuel.deviceTime", (row) =>
      "device_time" in row ? format(row.device_time) : null,
    ),
    {
      id: "provenance",
      headerKey: "fleet.history.provenance",
      cell: (row) => ("litres" in row ? <FleetFuelFacts load={row} code={code} /> : null),
    },
  ];
}
function actionColumn(actions: HistoryActions, t: (key: MessageKey) => string): Column {
  return {
    id: "actions",
    headerKey: "fleet.history.actions",
    cell: (row) => {
      if ("is_cleared" in row) return <FleetFaultFacts fault={row} actions={actions} />;
      if (!("voided_at" in row) || !actions.canManage) return null;
      return (
        <Button
          variant="secondary"
          aria-disabled={!!row.voided_at || actions.isUnverified}
          onClick={() => {
            if (!row.voided_at && !actions.isUnverified) actions.onVoid(row);
          }}
        >
          {t("common.actions.void")}
        </Button>
      );
    },
  };
}
interface ColumnContext {
  tab: HistoryTab;
  code: string;
  format: (date: string) => string;
  calendar: (date: string) => string;
  t: (key: MessageKey) => string;
  courierName: (id: string | null) => string;
}
function identityColumns({ tab, code, format, t }: ColumnContext): Column[] {
  return [
    {
      id: "id",
      headerKey: "fleet.history.record",
      cell: (row) => (
        <FleetSourceLink code={code} target={{ tab, id: row.id }}>
          {t("fleet.history.openRecord")}
        </FleetSourceLink>
      ),
    },
    { id: "created_at", headerKey: "fleet.history.created", cell: (row) => format(row.created_at) },
    scalar("created_by", "fleet.history.author", (row) =>
      row.created_by ? nameOrDash(row.created_by_name) : t("fleet.summary.system"),
    ),
  ];
}
function contentColumns(context: ColumnContext): Column[] {
  const { tab, code, calendar, format, t, courierName } = context;
  if (tab === "services")
    return [
      {
        id: "kind",
        headerKey: "fleet.service.kind",
        cell: (row) => ("kind" in row ? t(`fleet.service.${row.kind}`) : null),
      },
      ...serviceColumns(calendar),
    ];
  if (tab === "responsibility") return letterColumns(format, courierName);
  if (tab === "fuel") return fuelColumns(code, format);
  return [
    scalar("source", "fleet.history.event", (row) =>
      "field_event" in row && row.field_event ? t("fleet.history.fieldReport") : null,
    ),
  ];
}
export function useFleetHistoryColumns(
  tab: HistoryTab,
  code: string,
  actions: HistoryActions,
): Column[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const calendar = useFormatCalendarDate();
  const search = useSearch({ strict: false });
  const courierName = useCouriers([]).nameOf;
  const context = { tab, code, format, calendar, t, courierName };
  const columns = [...identityColumns(context), ...contentColumns(context)];
  if (tab !== "fuel" && tab !== "incidents")
    columns.push(
      scalar("notes", "fleet.history.notes", (row) => ("notes" in row ? row.notes : null)),
    );
  if (tab !== "fuel") columns.push(actionColumn(actions, t));
  return columns.map((column) => ({
    ...column,
    cell: (row) => <div className={styles.historyCell}>{column.cell(row)}</div>,
    ...(NUMBER_COLUMNS.has(column.id)
      ? {
          link: (row) => ({
            to: "/fleet/motorcycles/$code",
            params: { code },
            search: { ...search, tab, [HISTORY_PREFIX[tab] + "source"]: row.id },
          }),
        }
      : {}),
  }));
}
