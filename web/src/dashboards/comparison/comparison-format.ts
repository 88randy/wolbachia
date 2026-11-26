import type { ComparisonRow } from "./comparison-query";

/** The name of a bar: quadrant code and center, or the center alone when comparing centers. */
export function rowName(row: ComparisonRow): string {
  return row.quadrant_code === null ? row.center_name : `${row.quadrant_code} · ${row.center_name}`;
}

const CENTER_COLORS = [
  "var(--web-chart-1)",
  "var(--web-chart-2)",
  "var(--web-chart-3)",
  "var(--web-chart-4)",
] as const;

/** One color per center, stable for the rows in view; the center name is always written too. */
export function centerColors(rows: readonly ComparisonRow[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const row of rows) {
    if (!colors.has(row.center_id)) {
      colors.set(row.center_id, CENTER_COLORS[colors.size % CENTER_COLORS.length] ?? "");
    }
  }
  return colors;
}
