import type { Schemas } from "@wolbachia/api-client";
export type ConditionMetric = "temperature" | "humidity";
export function metricValues(row: Schemas["Condition"], metric: ConditionMetric) {
  const value = metric === "temperature" ? row.temperature_c : row.humidity_pct;
  const minimum = metric === "temperature" ? row.range?.temperature_min : row.range?.humidity_min;
  const maximum = metric === "temperature" ? row.range?.temperature_max : row.range?.humidity_max;
  return { value, minimum, maximum };
}
/** Missing historical ranges stay absent; no contemporary protocol substitutes for them. */
export function chartReadings(rows: readonly Schemas["Condition"][], metric: ConditionMetric) {
  return rows
    .filter((row) => {
      const { value, minimum, maximum } = metricValues(row, metric);
      return [value, minimum, maximum].every(
        (number) => number !== null && number !== undefined && Number.isFinite(Number(number)),
      );
    })
    .slice()
    .sort(
      (left, right) =>
        Date.parse(left.device_time) - Date.parse(right.device_time) ||
        Date.parse(left.server_received_at) - Date.parse(right.server_received_at) ||
        left.id.localeCompare(right.id),
    );
}
