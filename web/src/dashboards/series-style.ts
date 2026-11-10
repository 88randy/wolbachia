/**
 * Series look: color comes from the chart tokens, and the dash pattern repeats the difference
 * so a series is never told apart by color alone (WCAG 1.4.1).
 */
const COLORS = [
  "var(--web-chart-1)",
  "var(--web-chart-2)",
  "var(--web-chart-3)",
  "var(--web-chart-4)",
] as const;
const DASHES = [undefined, "7 4", "2 4", "9 4 2 4"] as const;

export function seriesColor(index: number): string {
  return COLORS[index % COLORS.length] ?? COLORS[0];
}

export function seriesDash(index: number): string | undefined {
  return DASHES[index % DASHES.length];
}

/** Grouped bars compare a plan with what was done: plan in neutral gray, done in the action blue. */
const BAR_COLORS = ["var(--web-chart-3)", "var(--web-chart-1)", "var(--web-chart-2)"] as const;

export function barColor(index: number): string {
  return BAR_COLORS[index % BAR_COLORS.length] ?? BAR_COLORS[0];
}
