import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { TrendChart } from "../../analytics/TrendChart";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { metricValues } from "./condition-chart";
import type { ConditionMetric } from "./condition-chart";
const SERIES = [
  { id: "value", key: "conditions.field.reading", tone: 1 },
  { id: "minimum", key: "conditions.field.minimum", tone: 3 },
  { id: "maximum", key: "conditions.field.maximum", tone: 4 },
] as const;
export function ConditionTrend({
  rows,
  metric,
}: {
  rows: readonly Schemas["Condition"][];
  metric: ConditionMetric;
}) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const series = SERIES.map(({ id, key, tone }) => ({
    id,
    label: t(key),
    tone,
    values: rows.map((row) => Number(metricValues(row, metric)[id])),
  }));
  return (
    <TrendChart
      title={t(`conditions.field.${metric}`)}
      labels={rows.map((row) => format(row.device_time))}
      valueSuffix={metric === "temperature" ? "°C" : "%"}
      series={series}
    />
  );
}
