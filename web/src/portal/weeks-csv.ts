import type { WeekRow } from "./portal-data";

/** Byte order mark, so Excel reads the accents. */
const BOM = String.fromCharCode(0xfeff);

interface Headers {
  week: string;
  releases: string;
  quantity: string;
}

/** The numbers of the chart as a CSV (with BOM so Excel reads the accents). Aggregates only. */
export function downloadWeeksCsv(weeks: readonly WeekRow[], headers: Headers): void {
  const lines = [
    [headers.week, headers.releases, headers.quantity],
    ...weeks.map((week) => [week.weekStart, String(week.releases), String(week.quantity)]),
  ].map((cells) => cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","));
  const blob = new Blob([`${BOM}${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = "releases-by-week.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(address);
}
