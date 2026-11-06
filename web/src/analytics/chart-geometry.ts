import { web } from "@wolbachia/tokens";
import type { ChartSeries } from "./chart-types";
export const GEOMETRY = web.chartGeometry;
/** Include zero in the domain so deltas and bars preserve honest magnitudes. */
export function chartDomain(series: readonly ChartSeries[]): { min: number; max: number } {
  const values = series.flatMap((item) => item.values).filter(Number.isFinite);
  const min = Math.min(0, ...values);
  return { min, max: Math.max(1, min + 1, ...values) };
}
export function chartX(index: number, count: number): number {
  return (
    GEOMETRY.padding + (index / Math.max(1, count - 1)) * (GEOMETRY.width - 2 * GEOMETRY.padding)
  );
}
export function chartY(value: number, domain: { min: number; max: number }): number {
  return (
    GEOMETRY.height -
    GEOMETRY.padding -
    ((value - domain.min) / (domain.max - domain.min)) * (GEOMETRY.height - 2 * GEOMETRY.padding)
  );
}
export function linePath(values: readonly number[], domain: { min: number; max: number }): string {
  return values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${String(chartX(index, values.length))},${String(chartY(value, domain))}`,
    )
    .join(" ");
}

/** All four palette series have a distinct non-color line encoding derived from marker geometry. */
export function chartDashPattern(index: number): string {
  const unit = GEOMETRY.markerSize;
  const patterns = [
    "none",
    `${String(unit * 2)} ${String(unit)}`,
    `${String(unit)} ${String(unit)}`,
    `${String(unit * 3)} ${String(unit)} ${String(unit)} ${String(unit)}`,
  ];
  return patterns[index % 4] ?? "none";
}
