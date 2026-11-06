import type { AssignedTask, CachedTask, LocalWork } from "./types.ts";
import { hasCoordinates } from "./assignment-parser.ts";
import { currentLocation } from "./location.ts";
import type { LocationState, LocationFix } from "./location.ts";
import { taskWork } from "./local-work.ts";
const EARTH_RADIUS_M = 6_371_000;
const RADIANS = Math.PI / 180;
function distance(task: AssignedTask, fix: LocationFix): number | null {
  if (!hasCoordinates(task)) return null;
  const lat = (task.lat - fix.lat) * RADIANS;
  const lng = (task.lng - fix.lng) * RADIANS;
  const arc =
    Math.sin(lat / 2) ** 2 +
    Math.cos(task.lat * RADIANS) * Math.cos(fix.lat * RADIANS) * Math.sin(lng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.min(1, Math.sqrt(arc)));
}
export interface DayTask extends CachedTask {
  readonly distanceM: number | null;
  readonly isReviewed: boolean;
  readonly delivery: "phone" | "received" | "none";
}
function overlay(row: CachedTask, work: readonly LocalWork[], fix: LocationFix | null): DayTask {
  const captures = taskWork(row.task, work);
  const isLocal = captures.some((entry) =>
    ["pending", "sending", "error", "sent", "in_review"].includes(entry.status),
  );
  const isReceived = captures.some((entry) =>
    ["sent", "in_review", "rejected"].includes(entry.status),
  );
  return {
    ...row,
    distanceM: fix === null ? null : distance(row.task, fix),
    isReviewed: isLocal,
    delivery: isReceived ? "received" : isLocal ? "phone" : "none",
  };
}
function compare(left: DayTask, right: DayTask): number {
  const risk = Number(right.task.risk === "high") - Number(left.task.risk === "high");
  return (
    risk ||
    (left.distanceM ?? Infinity) - (right.distanceM ?? Infinity) ||
    left.task.point_code.localeCompare(right.task.point_code)
  );
}
/** Risk first; distance only from a fresh real fix. Local capture never claims server review. */
export function buildDay(input: {
  readonly tasks: readonly CachedTask[];
  readonly work: readonly LocalWork[];
  readonly location: LocationState;
  readonly now: Date;
}) {
  const location = currentLocation(input.location, input.now);
  const fix = location.kind === "granted" ? location.fix : null;
  const tasks = input.tasks.map((row) => overlay(row, input.work, fix)).sort(compare);
  return {
    tasks,
    location,
    pendingTasks: tasks.filter((row) => !row.isReviewed),
    closedTasks: [] as DayTask[],
    reviewedTasks: tasks.filter((row) => row.isReviewed),
    reviewed: tasks.filter((row) => row.isReviewed).length,
    total: tasks.length,
  };
}
/** Scanner routing stays inside explicitly downloaded assignments. No server lookup. */
export function findAssignedTaskByPointCode(
  code: string,
  tasks: readonly CachedTask[],
): AssignedTask | null {
  const pointCode = code.trim();
  return (
    tasks.find(
      ({ task }) =>
        task.point_code === pointCode ||
        task.point_code === `${pointCode}:${task.action}:${task.date}`,
    )?.task ?? null
  );
}

export type LocatedDayTask = DayTask & {
  readonly task: AssignedTask & { readonly lat: number; readonly lng: number };
};
/** Missing point enrichment means list-only work, never a marker at fabricated coordinates. */
export function mapTasks(rows: readonly DayTask[]): readonly LocatedDayTask[] {
  return rows.filter((row): row is LocatedDayTask => hasCoordinates(row.task));
}
