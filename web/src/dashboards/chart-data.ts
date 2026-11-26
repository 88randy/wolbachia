import type { Dashboard } from "./dashboard-query";

type Chart = Dashboard["charts"][number];

/** One x position of a chart with the value of every series (`s0`, `s1`, ...). */
export type ChartRow = Record<string, string | number | null | readonly [number, number]>;

export interface SeriesInfo {
  /** Key of the value in each `ChartRow`. */
  dataKey: string;
  /** Key of the confidence band `[low, high]` in each `ChartRow`, when the series has one. */
  bandKey: string | null;
  source: Chart["series"][number];
}

export interface ChartData {
  rows: ChartRow[];
  series: SeriesInfo[];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Pivots `series[].points` into one row per x, ready for Recharts. Order follows first appearance. */
export function buildChartData(chart: Chart): ChartData {
  const order: string[] = [];
  const byX = new Map<string, ChartRow>();
  const series = chart.series.map((source, index): SeriesInfo => {
    const hasBand = source.points.some(
      (point) => numberOrNull(point["ci_low"]) !== null && numberOrNull(point["ci_high"]) !== null,
    );
    return { dataKey: `s${String(index)}`, bandKey: hasBand ? `b${String(index)}` : null, source };
  });
  series.forEach((info) => {
    info.source.points.forEach((point) => {
      const x = String(point["x"]);
      let row = byX.get(x);
      if (row === undefined) {
        row = { x };
        byX.set(x, row);
        order.push(x);
      }
      row[info.dataKey] = numberOrNull(point["y"]);
      row[`${info.dataKey}n`] = numberOrNull(point["n"]);
      const low = numberOrNull(point["ci_low"]);
      const high = numberOrNull(point["ci_high"]);
      if (info.bandKey !== null)
        row[info.bandKey] = low !== null && high !== null ? [low, high] : null;
    });
  });
  const rows = order.map((x) => byX.get(x) ?? { x });
  return { rows: rows.sort((a, b) => String(a["x"]).localeCompare(String(b["x"]))), series };
}

const DATE_X = /^(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})$/;

/** The x values are calendar dates (a day or the start of an epi week), or plain categories. */
export function isDateAxis(rows: readonly ChartRow[]): boolean {
  return rows.length > 0 && rows.every((row) => DATE_X.test(String(row["x"])));
}
