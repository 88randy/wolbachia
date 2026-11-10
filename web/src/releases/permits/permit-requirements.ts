/** `max_gps_accuracy_m` is the only requirement the backend accepts today (validate_requirements). */
export function maxGpsAccuracy(requirements: unknown): number | null {
  if (typeof requirements !== "object" || requirements === null) return null;
  const value = (requirements as Record<string, unknown>)["max_gps_accuracy_m"];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
