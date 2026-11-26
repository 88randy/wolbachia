/* eslint-disable max-lines-per-function -- presentational JSX of a dashboard widget; splitting it into one-use fragments would hurt readability. */
import { useTranslation } from "react-i18next";
import type { ChartConfig } from "@/components/ui/chart";
import type { ChartData, ChartRow } from "./chart-data";
import type { Granularity } from "./dashboard-filters";
import { useDashboardText } from "./use-dashboard-text";

interface ChartTooltipBodyProps {
  active: boolean;
  label: string | number | undefined;
  data: ChartData;
  config: ChartConfig;
  unit: string;
  granularity: Granularity;
  isDateAxis: boolean;
  categoryColumn: string | null;
}

/** Tooltip of every chart: the x value, then each series with its value (and interval, if any). */
export function ChartTooltipBody(props: ChartTooltipBodyProps) {
  const { active, label, data, config, unit, granularity, isDateAxis, categoryColumn } = props;
  const { t } = useTranslation();
  const text = useDashboardText();
  if (!active || label === undefined) return null;
  const row: ChartRow | undefined = data.rows.find((candidate) => candidate["x"] === label);
  if (row === undefined) return null;
  const heading = isDateAxis
    ? text.axisLong(String(label), granularity)
    : text.cell(categoryColumn ?? "", label, granularity);
  return (
    <div className="grid min-w-44 gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink shadow-overlay">
      <p className="m-0 font-semibold">{heading}</p>
      {data.series.map((series) => {
        const value = row[series.dataKey];
        const band = series.bandKey === null ? undefined : row[series.bandKey];
        const tested = row[`${series.dataKey}n`];
        return (
          <div key={series.dataKey} className="grid gap-0.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 flex-none rounded-sm"
                style={{ background: config[series.dataKey]?.color }}
              />
              <span className="flex-1 text-ink-2">{config[series.dataKey]?.label}</span>
              <span className="font-semibold tabular-nums">
                {typeof value === "number"
                  ? text.withUnit(value, unit)
                  : t("analytics.kpi.noValue")}
              </span>
            </div>
            {Array.isArray(band) && typeof value === "number" && (
              <span className="pl-4.5 text-ink-3 tabular-nums">
                {t("analytics.chart.ciLabel", {
                  low: text.number(Number(band[0])),
                  high: text.number(Number(band[1])),
                })}
              </span>
            )}
            {typeof tested === "number" && (
              <span className="pl-4.5 text-ink-3 tabular-nums">
                {t("analytics.chart.tested", { n: text.number(tested) })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
