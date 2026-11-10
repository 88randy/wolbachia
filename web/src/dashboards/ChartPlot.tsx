/* eslint-disable max-lines-per-function -- presentational JSX of a dashboard widget; splitting it into one-use fragments would hurt readability. */
import { Area, Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import type { ChartData } from "./chart-data";
import { isDateAxis } from "./chart-data";
import { ChartTooltipBody } from "./ChartTooltipBody";
import type { Granularity } from "./dashboard-filters";
import { seriesColor, seriesDash } from "./series-style";
import { useDashboardText } from "./use-dashboard-text";

interface ChartPlotProps {
  kind: "bar" | "line";
  unit: string;
  data: ChartData;
  config: ChartConfig;
  granularity: Granularity;
  /** Key of the confidence band to draw, if any. */
  bandKey: string | null;
  /** Table column that names the category axis (`quadrant`, `state`), for translated tooltips. */
  categoryColumn: string | null;
  ariaLabel: string;
}

const AXIS_HEIGHT = 280;
const PERCENT_MAX = 100;
const Y_WIDTH = 48;
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** The Recharts drawing of one chart: lines (with an optional band) or grouped bars. */
export function ChartPlot(props: ChartPlotProps) {
  const { kind, unit, data, config, granularity, bandKey, categoryColumn, ariaLabel } = props;
  const text = useDashboardText();
  const onDates = isDateAxis(data.rows);
  const tick = (value: string | number) =>
    onDates
      ? text.axis(String(value), granularity)
      : text.cell(categoryColumn ?? "", value, granularity);
  return (
    <ChartContainer config={config} height={AXIS_HEIGHT} role="img" aria-label={ariaLabel}>
      <ComposedChart data={data.rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--web-chart-grid)" />
        <XAxis
          dataKey="x"
          tickLine={false}
          axisLine={{ stroke: "var(--web-chart-grid)" }}
          tickMargin={8}
          tickFormatter={tick}
          minTickGap={16}
        />
        <YAxis
          width={Y_WIDTH}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => text.number(value)}
          domain={unit === "percent" ? [0, PERCENT_MAX] : [0, "auto"]}
          allowDecimals
        />
        <Tooltip
          cursor={{ stroke: "var(--web-chart-axis)", strokeDasharray: "3 3" }}
          content={(tooltip) => (
            <ChartTooltipBody
              active={tooltip.active}
              label={tooltip.label}
              data={data}
              config={config}
              unit={unit}
              granularity={granularity}
              isDateAxis={onDates}
              categoryColumn={categoryColumn}
            />
          )}
        />
        {kind === "line" && bandKey !== null && (
          <Area
            dataKey={bandKey}
            stroke="none"
            fill="var(--web-chart-1)"
            fillOpacity={0.16}
            isAnimationActive={false}
            activeDot={false}
            legendType="none"
            connectNulls
          />
        )}
        {data.series.map((series, index) =>
          kind === "bar" ? (
            <Bar
              key={series.dataKey}
              dataKey={series.dataKey}
              fill={`var(--color-${series.dataKey})`}
              radius={BAR_RADIUS}
              maxBarSize={36}
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={series.dataKey}
              type="monotone"
              dataKey={series.dataKey}
              stroke={seriesColor(index)}
              strokeWidth={2}
              strokeDasharray={seriesDash(index)}
              dot={{ r: 3, fill: seriesColor(index), stroke: "var(--color-surface)" }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          ),
        )}
      </ComposedChart>
    </ChartContainer>
  );
}
