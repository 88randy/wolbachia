import type { DayLoad } from "./scheduling-queries";

/** Courier -> day -> number of points. */
export function loadTable(days: readonly string[], perDay: readonly DayLoad[] | undefined) {
  const table = new Map<string, Map<string, number>>();
  perDay?.forEach((entry, index) => {
    const date = days[index];
    for (const row of entry.loads) {
      if (row.courier === null || date === undefined) continue;
      const byDay = table.get(row.courier) ?? new Map<string, number>();
      byDay.set(date, row.load);
      table.set(row.courier, byDay);
    }
  });
  return table;
}
