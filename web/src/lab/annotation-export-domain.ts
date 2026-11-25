const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EXPORT_DAYS = 366;
const POLL_INTERVAL_MS = 3000;

export type ExportDateError = "required" | "invalid" | "range" | "tooLong";

function dayTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return NaN;
  const instant = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(instant)) return NaN;
  return new Date(instant).toISOString().slice(0, 10) === value ? instant : NaN;
}

/** Calendar days are inclusive; UTC arithmetic avoids local daylight-saving changes. */
export function validateExportDates(from: string, to: string): ExportDateError | null {
  if (from === "" || to === "") return "required";
  const start = dayTime(from);
  const end = dayTime(to);
  if (to === "9999-12-31") return "invalid";
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalid";
  if (end < start) return "range";
  return (end - start) / DAY_MS + 1 > MAX_EXPORT_DAYS ? "tooLong" : null;
}

/** TanStack Query owns polling and stops when this page has only terminal jobs. */
export function exportPollInterval(
  rows: readonly { status: string }[] | undefined,
): number | false {
  return rows?.some((row) => row.status === "queued" || row.status === "running")
    ? POLL_INTERVAL_MS
    : false;
}
