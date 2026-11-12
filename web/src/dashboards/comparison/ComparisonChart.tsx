/* eslint-disable max-lines-per-function -- presentational JSX of a chart; splitting it into one-use fragments would hurt readability. */
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { useFormatNumber } from "../../format/use-formatters";
import { centerColors, rowName } from "./comparison-format";
import type { ComparisonRow } from "./comparison-query";

const ROW_HEIGHT = 40;
const AXIS_HEIGHT = 36;
const NAME_WIDTH = 230;
const MAX_BAR = 26;

interface ComparisonChartProps {
  rows: readonly ComparisonRow[];
  unit: string;
  ariaLabel: string;
}

/** Horizontal bars, highest first. Rows with no value are left out (they show in the table). */
export function ComparisonChart({ rows, unit, ariaLabel }: ComparisonChartProps) {
  const format = useFormatNumber();
  const colors = centerColors(rows);
  const data = rows
    .filter((row) => row.value !== null)
    .map((row) => ({
      name: rowName(row),
      value: row.value,
      fill: colors.get(row.center_id) ?? "var(--web-chart-1)",
    }));
  const text = (value: unknown) =>
    typeof value === "number" ? `${format(value)}${unit === "percent" ? " %" : ""}` : "";
  return (
    <ChartContainer
      config={{ value: { label: ariaLabel, color: "var(--web-chart-1)" } }}
      height={data.length * ROW_HEIGHT + AXIS_HEIGHT}
      role="img"
      aria-label={ariaLabel}
    >
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--web-chart-grid)" />
        <XAxis
          type="number"
          domain={[0, unit === "percent" ? 100 : "auto"]}
          tickLine={false}
          axisLine={{ stroke: "var(--web-chart-grid)" }}
          tickFormatter={(value: number) => format(value)}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={NAME_WIDTH}
          tickLine={false}
          axisLine={{ stroke: "var(--web-chart-axis)" }}
          interval={0}
        />
        <Bar dataKey="value" maxBarSize={MAX_BAR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" formatter={text} className="fill-ink" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
