import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCalendar,
  CALENDAR_WINDOW_DAYS,
  calendarStatus,
} from "../src/features/calendar/domain.ts";
import { LOCAL_RETENTION_MS } from "../src/features/track/track-store.ts";
import type { CalendarInput } from "../src/features/calendar/domain.ts";
import type { CachedTask } from "../src/features/day/types.ts";
import type { HistoryEntry } from "../src/features/history/domain.ts";

const TODAY = "2026-11-25";
const entry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
  id: "e-1",
  kind: "ovitrap.check",
  sourceId: null,
  shiftId: null,
  time: "2026-11-25T15:00:00.000Z",
  codes: ["OV-1"],
  status: "sent",
  reason: null,
  author: null,
  voidsId: null,
  isServerDecision: false,
  observation: null,
  ...overrides,
});
const task = (date: string, serverCompletion: boolean | null, code = "P-1"): CachedTask => ({
  task: {
    id: `${code}:${date}`,
    point_code: code,
    point_id: code,
    courier: "courier",
    action: "check",
    date,
    risk: "normal",
    version: "1",
    quadrant_id: "q",
    history: [],
  },
  isKept: false,
  serverCompletion,
});
const calendar = (overrides: Partial<CalendarInput>) =>
  buildCalendar({
    entries: [],
    unscoped: [],
    tasks: [],
    timeZone: "America/Merida",
    epiWeek: "iso",
    today: TODAY,
    ...overrides,
  });
const day = (result: ReturnType<typeof buildCalendar>, date: string) => {
  const found = result.days.find((candidate) => candidate.date === date);
  assert.ok(found, `missing ${date}`);
  return found;
};

void test("P33 day key follows the organization zone, not UTC; an invalid zone uses the default", () => {
  // 23:30 in Merida (UTC-6) on Nov 20 is 05:30 UTC on Nov 21.
  for (const timeZone of ["America/Merida", "Not/AZone", null]) {
    const result = calendar({ entries: [entry({ time: "2026-11-21T05:30:00.000Z" })], timeZone });
    assert.equal(day(result, "2026-11-20").items.length, 1);
    assert.equal(day(result, "2026-11-21").items.length, 0);
  }
});

void test("P33 an unparsable time is listed last on today and never marks the grid", () => {
  const result = calendar({
    entries: [entry({ id: "bad", time: "not-a-time", status: "pending" }), entry({ id: "ok" })],
  });
  const today = day(result, TODAY);
  assert.deepEqual(
    today.items.map((item) => item.id),
    ["ok", "bad"],
  );
  assert.equal(today.hasPending, false);
});

void test("P33 window: the 29 previous days, the rest of the open epi week and downloaded task dates", () => {
  const empty = calendar({});
  assert.equal(day(empty, "2026-10-27").isInWindow, true);
  assert.equal(day(empty, "2026-10-26").isInWindow, false);
  assert.equal(day(empty, TODAY).isInWindow, true);
  // #374: the rest of the iso week (Mon 23 - Sun 29) is open even without tasks.
  assert.deepEqual(day(empty, "2026-11-29"), {
    date: "2026-11-29",
    items: [],
    hasActivity: false,
    hasPending: false,
    isInWindow: true,
  });
  assert.equal(day(empty, "2026-11-30").isInWindow, false);
  assert.equal(day(calendar({ epiWeek: "mmwr" }), "2026-11-28").isInWindow, true);
  assert.equal(day(calendar({ epiWeek: "mmwr" }), "2026-11-29").isInWindow, false);

  const withTasks = calendar({ tasks: [task("2026-12-02", false)] });
  assert.equal(day(withTasks, "2026-12-01").isInWindow, true);
  assert.equal(day(withTasks, "2026-12-02").isInWindow, true);
  assert.equal(day(withTasks, "2026-12-03").isInWindow, false);
  assert.deepEqual(
    withTasks.monthWeeks.map((month) => month.month),
    ["2026-10", "2026-11", "2026-12"],
  );
});

void test("P33 week start: iso and missing start on Monday, mmwr on Sunday", () => {
  const weekdays = (epiWeek: string | null) =>
    calendar({ epiWeek }).monthWeeks.flatMap((month) =>
      month.weeks.map((week) => new Date(`${week[0] ?? ""}T00:00:00Z`).getUTCDay()),
    );
  assert.ok(weekdays("iso").every((weekday) => weekday === 1));
  assert.ok(weekdays(null).every((weekday) => weekday === 1));
  assert.ok(weekdays("mmwr").every((weekday) => weekday === 0));
  const november = calendar({ epiWeek: "mmwr" }).monthWeeks.find((m) => m.month === "2026-11");
  assert.equal(november?.weeks[0]?.[0], "2026-11-01", "Nov 1 2026 is a Sunday");
  assert.ok(november.weeks.flat().includes("2026-11-30"));
});

void test("P33 task status table: done, scheduled, missed and unconfirmed", () => {
  const cases: [CachedTask, string][] = [
    [task("2026-11-20", true), "done"],
    [task(TODAY, false), "scheduled"],
    [task(TODAY, null), "scheduled"],
    [task("2026-11-27", null), "scheduled"],
    [task("2026-11-20", false), "missed"],
    [task("2026-11-20", null), "unconfirmed"],
  ];
  for (const [row, status] of cases)
    assert.equal(
      calendarStatus(row, TODAY, "iso"),
      status,
      `${row.task.date} ${String(row.serverCompletion)}`,
    );
});

void test("P33 history status table: D2 reviewed stays reviewed, a delivered void reads as voided", () => {
  assert.equal(calendarStatus(entry({ status: "reviewed" }), TODAY, "iso"), "reviewed");
  assert.equal(
    calendarStatus(entry({ kind: "record.void", status: "sent" }), TODAY, "iso"),
    "voided",
  );
  for (const status of ["pending", "rejected", "in_review"] as const)
    assert.equal(calendarStatus(entry({ kind: "record.void", status }), TODAY, "iso"), status);
});

void test("P33 hasPending marks unsent activity and scheduled or missed tasks only", () => {
  const result = calendar({
    entries: [entry({ time: "2026-11-24T15:00:00.000Z", status: "sent" })],
    unscoped: [
      { id: "fuel", kind: "fuel.load", time: "2026-11-23T15:00:00.000Z", status: "error" },
    ],
    tasks: [task("2026-11-22", true), task("2026-11-21", false), task(TODAY, null)],
  });
  assert.deepEqual(
    ["2026-11-24", "2026-11-23", "2026-11-22", "2026-11-21", TODAY].map((date) => {
      const { hasPending, hasActivity } = day(result, date);
      return [date, hasPending, hasActivity];
    }),
    [
      ["2026-11-24", false, true],
      ["2026-11-23", true, true],
      ["2026-11-22", false, false],
      ["2026-11-21", true, false],
      [TODAY, true, false],
    ],
  );
  const unscoped = day(result, "2026-11-23").items[0];
  assert.deepEqual(unscoped && [unscoped.codes, unscoped.isScoped, unscoped.source], [
    [],
    false,
    "local",
  ]);
});

void test("P33 a day outside the window is empty even when the outbox still holds its facts", () => {
  const result = calendar({
    entries: [entry({ time: "2026-10-10T15:00:00.000Z", status: "pending" })],
    tasks: [task("2026-10-10", false)],
  });
  assert.deepEqual(day(result, "2026-10-10"), {
    date: "2026-10-10",
    items: [],
    hasActivity: false,
    hasPending: false,
    isInWindow: false,
  });
});

void test("P33 the calendar window never exceeds the phone's track retention", () => {
  assert.ok(CALENDAR_WINDOW_DAYS * 86_400_000 <= LOCAL_RETENTION_MS);
});

void test("#374 a Monday task stays scheduled through its epi week and is missed after it (iso, mmwr)", () => {
  const monday = task("2026-11-23", false);
  const unknown = task("2026-11-23", null);
  // Wednesday of the same week: both conventions keep it open.
  for (const epiWeek of ["iso", "mmwr"])
    assert.equal(calendarStatus(monday, "2026-11-25", epiWeek), "scheduled");
  // Sunday 29: the mmwr week (Sun 22 - Sat 28) ended; the iso week (Mon 23 - Sun 29) has not.
  assert.equal(calendarStatus(monday, "2026-11-29", "mmwr"), "missed");
  assert.equal(calendarStatus(unknown, "2026-11-29", "mmwr"), "unconfirmed");
  assert.equal(calendarStatus(monday, "2026-11-29", "iso"), "scheduled");
  assert.equal(calendarStatus(monday, "2026-11-30", "iso"), "missed");
  const grid = calendar({ tasks: [monday] });
  assert.equal(day(grid, "2026-11-23").items[0]?.status, "scheduled", "Programado on its date");
});
