import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { DataTableColumn } from "../../data-table/table-types";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { StatusPill } from "../../ui/StatusPill";
type Column = DataTableColumn<Schemas["Condition"]>;
type Translate = (key: MessageKey) => string;
const METRICS = [
  {
    id: "temperature",
    key: "conditions.field.temperature",
    rangeKey: "conditions.field.allowedTemperature",
    value: "temperature_c",
    min: "temperature_min",
    max: "temperature_max",
  },
  {
    id: "humidity",
    key: "conditions.field.humidity",
    rangeKey: "conditions.field.allowedHumidity",
    value: "humidity_pct",
    min: "humidity_min",
    max: "humidity_max",
  },
] as const;
function rangeText(
  min: string | null | undefined,
  max: string | null | undefined,
  fallback: string,
) {
  return min != null && max != null ? `${min}–${max}` : fallback;
}
function timeColumns(format: (instant: string) => string): Column[] {
  return [
    {
      id: "device_time",
      headerKey: "conditions.field.deviceTime",
      cell: (row) => format(row.device_time),
    },
    {
      id: "server_received_at",
      headerKey: "conditions.field.receivedTime",
      cell: (row) => format(row.server_received_at),
    },
  ];
}
function measurementColumns(fallback: string): Column[] {
  return METRICS.flatMap((metric): Column[] => [
    { id: metric.id, headerKey: metric.key, align: "end", cell: (row) => row[metric.value] },
    {
      id: `${metric.id}_range`,
      headerKey: metric.rangeKey,
      cell: (row) => rangeText(row.range?.[metric.min], row.range?.[metric.max], fallback),
    },
  ]);
}
function policyColumns(t: Translate): Column[] {
  return [
    {
      id: "protocol",
      headerKey: "conditions.section.protocol",
      cell: (row) =>
        row.range ? `${row.range.name} · ${row.range.id}` : t("conditions.state.noRange"),
    },
    {
      id: "slot",
      headerKey: "conditions.field.slot",
      cell: (row) =>
        row.slot == null
          ? t("conditions.state.noWindow")
          : t(row.slot === 0 ? "conditions.field.firstSlot" : "conditions.field.secondSlot"),
    },
  ];
}
function evaluationColumn(t: Translate): Column {
  return {
    id: "evaluation",
    headerKey: "conditions.field.evaluation",
    cell: (row) => (
      <StatusPill tone={row.evaluation === "normal" ? "success" : "warning"}>
        {t(`conditions.evaluation.${row.evaluation}`)}
      </StatusPill>
    ),
  };
}
export function useConditionColumns(): Column[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return [
    ...timeColumns(format),
    ...measurementColumns(t("conditions.state.noRange")),
    ...policyColumns(t),
    evaluationColumn(t),
  ];
}
