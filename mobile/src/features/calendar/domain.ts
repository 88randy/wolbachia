import { DEFAULT_TIME_ZONE } from "../../sync/format-time.ts";
import { captureLocalDate } from "../day/capture-local-date.ts";
import { epiWeekEnd, weekStartDay } from "../day/epi-week.ts";
import { displayPointCode } from "../day/point-code.ts";
import type { AssignedTask, CachedTask } from "../day/types.ts";
import type { HistoryEntry, UnscopedEntry } from "../history/domain.ts";

export type CalendarStatus =
  | "pending"
  | "sending"
  | "error"
  | "sent"
  | "in_review"
  | "rejected"
  | "reviewed"
  | "voided"
  | "observed"
  | "scheduled"
  | "done"
  | "missed"
  | "unconfirmed";
export interface CalendarItem {
  readonly id: string;
  readonly kind: string;
  readonly time: string | null;
  readonly status: CalendarStatus;
  readonly codes: readonly string[];
  readonly isScoped: boolean;
  readonly source: "history" | "local" | "task";
  /** The downloaded task behind a `task` row (P33 opens today's like P9); null for activity. */
  readonly task: AssignedTask | null;
}
export interface CalendarDay {
  /** YYYY-MM-DD in the organization time zone. */
  readonly date: string;
  readonly items: readonly CalendarItem[];
  readonly hasActivity: boolean;
  readonly hasPending: boolean;
  readonly isInWindow: boolean;
}
export interface CalendarMonth {
  /** YYYY-MM. */
  readonly month: string;
  /** Rows of 7 dates from the organization's week start; edge dates may belong to other months. */
  readonly weeks: readonly (readonly string[])[];
}
export interface CalendarInput {
  readonly entries: readonly HistoryEntry[];
  readonly unscoped: readonly UnscopedEntry[];
  readonly tasks: readonly CachedTask[];
  readonly timeZone: string | null;
  readonly epiWeek: string | null;
  /** YYYY-MM-DD in the organization time zone. */
  readonly today: string;
}

const DAY_MS = 86_400_000;
/**
 * Owner decision (#373): past = today and the 29 previous local days. It must stay within the
 * track retention (`LOCAL_RETENTION_MS`) so a window day never promises pruned points.
 */
export const CALENDAR_WINDOW_DAYS = 30;
/** Statuses that mark a day as pending (ring with clock in the grid). */
export const PENDING: readonly CalendarStatus[] = [
  "pending",
  "sending",
  "error",
  "scheduled",
  "missed",
];

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T00:00:00.000Z`).getUTCDay();
/** Unparsable times sort last. */
const instant = (time: string | null) => {
  const value = time === null ? NaN : Date.parse(time);
  return Number.isFinite(value) ? value : -Infinity;
};

/** Invalid or missing zone falls back to the organization default, as P29 does. */
export function resolveTimeZone(timeZone: string | null): string {
  return timeZone !== null && captureLocalDate(new Date(0).toISOString(), timeZone) !== null
    ? timeZone
    : DEFAULT_TIME_ZONE;
}

/**
 * Status of a task; local capture never decides completion (server only). #374: a weekly task
 * stays "scheduled" until its epi week ends, then reads "missed" (or "unconfirmed").
 */
function taskStatus(row: CachedTask, today: string, epiWeek: string | null): CalendarStatus {
  if (row.serverCompletion === true) return "done";
  if (today <= epiWeekEnd(row.task.date, epiWeek)) return "scheduled";
  return row.serverCompletion === false ? "missed" : "unconfirmed";
}

/** The status table of #373; D2: accepted decisions already arrive as `reviewed`. */
export function calendarStatus(
  item: HistoryEntry | UnscopedEntry | CachedTask,
  today: string,
  epiWeek: string | null,
): CalendarStatus {
  if ("task" in item) return taskStatus(item, today, epiWeek);
  // Only a delivered void voids; a rejected or in-review one keeps its own state.
  if (item.kind === "record.void" && item.status === "sent") return "voided";
  return item.status;
}

function taskItem(row: CachedTask, input: CalendarInput): CalendarItem {
  return {
    id: row.task.id,
    kind: row.task.action,
    time: null,
    status: calendarStatus(row, input.today, input.epiWeek),
    codes: [displayPointCode(row.task.point_code)],
    isScoped: true,
    source: "task",
    task: row.task,
  };
}
function activityItems(input: CalendarInput): readonly CalendarItem[] {
  const scoped = input.entries.map((entry): CalendarItem => ({
    id: entry.id,
    kind: entry.kind,
    time: entry.time,
    status: calendarStatus(entry, input.today, input.epiWeek),
    codes: entry.codes,
    isScoped: true,
    source: "history",
    task: null,
  }));
  const unscoped = input.unscoped.map((entry): CalendarItem => ({
    ...entry,
    status: calendarStatus(entry, input.today, input.epiWeek),
    codes: [],
    isScoped: false,
    source: "local",
    task: null,
  }));
  return [...scoped, ...unscoped].sort(
    (left, right) => instant(right.time) - instant(left.time) || left.id.localeCompare(right.id),
  );
}
function sortedTasks(tasks: readonly CachedTask[]): readonly CachedTask[] {
  return [...tasks].sort(
    (left, right) =>
      Number(right.task.risk === "high") - Number(left.task.risk === "high") ||
      left.task.point_code.localeCompare(right.task.point_code),
  );
}

/** Items per local date; an unparsable time joins today's list but never marks the grid. */
function itemsByDate(input: CalendarInput) {
  const zone = resolveTimeZone(input.timeZone);
  const dated = new Map<string, CalendarItem[]>();
  const undated: CalendarItem[] = [];
  const push = (date: string, item: CalendarItem) => {
    dated.set(date, [...(dated.get(date) ?? []), item]);
  };
  for (const row of sortedTasks(input.tasks)) push(row.task.date, taskItem(row, input));
  for (const item of activityItems(input)) {
    const date =
      item.time !== null && Number.isFinite(Date.parse(item.time))
        ? captureLocalDate(item.time, zone)
        : null;
    if (date === null) undated.push(item);
    else push(date, item);
  }
  return { dated, undated };
}

function monthWeeks(first: string, last: string, epiWeek: string | null): readonly CalendarMonth[] {
  const weekStart = weekStartDay(epiWeek);
  const months: CalendarMonth[] = [];
  for (let month = first.slice(0, 7); month <= last.slice(0, 7);) {
    const start = `${month}-01`;
    let day = addDays(start, -((weekday(start) - weekStart + 7) % 7));
    const weeks: string[][] = [];
    while (day.slice(0, 7) <= month) {
      weeks.push(Array.from({ length: 7 }, (_, index) => addDays(day, index)));
      day = addDays(day, 7);
    }
    months.push({ month, weeks });
    month = addDays(`${month}-28`, 7).slice(0, 7);
  }
  return months;
}

/**
 * The month grids and their days: past = today and the 29 previous local days; future = the
 * rest of the current epi week plus the dates of downloaded tasks. Days outside are laid out empty with `isInWindow: false`: the
 * outbox never deletes, so older facts must not light up the grid.
 */
export function buildCalendar(input: CalendarInput): {
  readonly days: readonly CalendarDay[];
  readonly monthWeeks: readonly CalendarMonth[];
} {
  const { dated, undated } = itemsByDate(input);
  const first = addDays(input.today, 1 - CALENDAR_WINDOW_DAYS);
  // #374: the rest of the open epi week is always shown, even before its tasks exist.
  const weekEnd = epiWeekEnd(input.today, input.epiWeek);
  const last = [weekEnd, ...input.tasks.map((row) => row.task.date)].sort().pop() ?? weekEnd;
  const months = monthWeeks(first, last, input.epiWeek);
  const days = [...new Set(months.flatMap((month) => month.weeks.flat()))].map(
    (date): CalendarDay => {
      const isInWindow = date >= first && date <= last;
      const items = isInWindow ? (dated.get(date) ?? []) : [];
      return {
        date,
        items: date === input.today ? [...items, ...undated] : items,
        hasActivity: items.some((item) => item.source !== "task"),
        hasPending: items.some((item) => PENDING.includes(item.status)),
        isInWindow,
      };
    },
  );
  return { days, monthWeeks: months };
}
