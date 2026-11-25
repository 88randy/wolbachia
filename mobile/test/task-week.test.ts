import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDay } from "../src/features/day/domain.ts";
import { epiWeekEnd, isWithinTaskWeek } from "../src/features/day/epi-week.ts";
import { taskWork } from "../src/features/day/local-work.ts";
import type { AssignedTask, CachedTask, LocalWork } from "../src/features/day/types.ts";

const POINT = "point-1";
const task = (date: string, id = `task-${date}`): AssignedTask => ({
  id,
  point_code: "OV-017",
  point_id: POINT,
  courier: "courier",
  action: "place",
  date,
  risk: "normal",
  version: "1",
  quadrant_id: "q",
  history: [],
});
const capture = (captureDate: string, origin: LocalWork["origin"] = "capture"): LocalWork => ({
  eventId: `event-${captureDate}`,
  origin,
  pointId: origin === "capture" ? POINT : null,
  captureDate,
  action: "place",
  taskId: null,
  ovitrapId: origin === "capture" ? null : "trap-1",
  status: "pending",
});
const linked = (due: AssignedTask, entry: LocalWork, epiWeek: string | null) =>
  taskWork(due, [entry], { visibleTasks: [due], epiWeek }).length === 1;
const linkedAmong = (due: AssignedTask, entry: LocalWork, visibleTasks: AssignedTask[]) =>
  taskWork(due, [entry], { visibleTasks, epiWeek: "iso" }).length === 1;

void test("#374 epi week end: iso Monday-Sunday, mmwr Sunday-Saturday, missing = iso", () => {
  assert.equal(epiWeekEnd("2026-11-23", "iso"), "2026-11-29");
  assert.equal(epiWeekEnd("2026-11-29", "iso"), "2026-11-29");
  assert.equal(epiWeekEnd("2026-11-23", "mmwr"), "2026-11-28");
  assert.equal(epiWeekEnd("2026-11-22", "mmwr"), "2026-11-28");
  assert.equal(epiWeekEnd("2026-11-22", null), "2026-11-22");
  assert.equal(isWithinTaskWeek("2026-11-23", null, "iso"), false);
});

void test("#374 a Tuesday capture completes the Monday task; the next week or an earlier day does not", () => {
  const monday = task("2026-11-23");
  for (const epiWeek of ["iso", "mmwr"]) {
    assert.ok(linked(monday, capture("2026-11-23"), epiWeek), `${epiWeek}: same day`);
    assert.ok(linked(monday, capture("2026-11-24"), epiWeek), `${epiWeek}: Tuesday`);
    assert.ok(!linked(monday, capture("2026-11-22"), epiWeek), `${epiWeek}: before the due date`);
    assert.ok(!linked(monday, capture("2026-11-30"), epiWeek), `${epiWeek}: next week`);
  }
  // Sunday 29 is still the iso week of Monday 23, but already the next mmwr week.
  assert.ok(linked(monday, capture("2026-11-29"), "iso"));
  assert.ok(!linked(monday, capture("2026-11-29"), "mmwr"));
});

void test("#374 a legacy Monday capture completes a Sunday task in an mmwr organization", () => {
  // Legacy rows carry no captured convention: the organization's epi week applies to every row.
  const sunday = { ...task("2026-11-22"), ovitrap_id: "trap-1" };
  assert.ok(linked(sunday, capture("2026-11-23", "legacy"), "mmwr"));
  assert.ok(!linked(sunday, capture("2026-11-29", "legacy"), "mmwr"), "next mmwr week");
});

void test("#374 the earliest due wins; equal identities stay unlinked", () => {
  const monday = task("2026-11-23");
  const wednesday = task("2026-11-25");
  const entry = capture("2026-11-25");
  assert.ok(linkedAmong(monday, entry, [monday, wednesday]));
  assert.ok(!linkedAmong(wednesday, entry, [monday, wednesday]));
  const twin = task("2026-11-23", "twin");
  assert.ok(!linkedAmong(monday, entry, [monday, twin]), "ambiguous identity is never guessed");
});

void test("#374 P9 route: a Tuesday capture shows as delivery work on the Monday task", () => {
  const row: CachedTask = { task: task("2026-11-23"), isKept: true, serverCompletion: false };
  const day = buildDay({
    epiWeek: "iso",
    tasks: [row],
    work: [capture("2026-11-24")],
    location: { kind: "unavailable" },
    now: new Date("2026-11-24T18:00:00.000Z"),
  });
  assert.equal(day.tasks[0]?.delivery.hasPendingUpload, true);
  assert.equal(day.tasks[0].completion, "pending", "local work never decides completion");
});
