import type { SqlExecutor, SqlRow } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import type { LocalWork, LocalWorkOverlay, AssignedTask } from "./types.ts";
import { captureLocalDate } from "./capture-local-date.ts";
import { isWithinTaskWeek } from "./epi-week.ts";
function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function localWork(row: SqlRow): LocalWork {
  const action = readText(row, "type").replace("ovitrap.", "");
  const isCapture =
    typeof row.capture_id === "string" &&
    row.mode === action &&
    row.captured_time === row.device_time;
  const pointId = isCapture ? textOrNull(row.point_id) : null;
  const taskId = textOrNull(row.task_id);
  const captureDate = isCapture
    ? captureLocalDate(readText(row, "device_time"), row.time_zone)
    : null;
  return {
    eventId: readText(row, "id"),
    action,
    taskId,
    ovitrapId: textOrNull(row.ovitrap_id),
    status: readText(row, "local_status"),
    pointId,
    captureDate: isCapture ? captureDate : readText(row, "device_time").slice(0, 10),
    origin: isCapture
      ? "capture"
      : taskId !== null || typeof row.ovitrap_id === "string"
        ? "legacy"
        : "unknown",
  };
}
/** Read-only provenance: capture history and the event envelope are never rewritten to add a task ID. */
export class OutboxWorkOverlay implements LocalWorkOverlay {
  readonly #db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.#db = db;
  }
  async read(): Promise<readonly LocalWork[]> {
    const rows = await this.#db.query(`SELECT e.id,json_extract(e.payload,'$.task_id') AS task_id,
      json_extract(e.payload,'$.ovitrap_id') AS ovitrap_id,e.device_time,e.type,e.local_status,
      c.event_id AS capture_id,json_extract(c.draft,'$.point.id') AS point_id,
      json_extract(c.draft,'$.mode') AS mode,json_extract(c.draft,'$.deviceTime') AS captured_time,
      json_extract(c.draft,'$.assignment.organization.timezone') AS time_zone
      FROM outbox_event e LEFT JOIN ovitrap_capture c ON c.event_id=e.id WHERE e.type LIKE 'ovitrap.%'`);
    return rows.map(localWork);
  }
}
function matchesCapture(task: AssignedTask, entry: LocalWork, epiWeek: string | null): boolean {
  if (entry.action !== task.action) return false;
  if (!isWithinTaskWeek(task.date, entry.captureDate, epiWeek)) return false;
  if (entry.origin === "capture") return entry.pointId !== null && entry.pointId === task.point_id;
  return (
    entry.origin === "legacy" &&
    task.ovitrap_id !== undefined &&
    entry.ovitrapId === task.ovitrap_id
  );
}
/**
 * A capture counts for the task with the same point/action due on or before it in the same epi
 * week (#374, as the backend). If tasks with different due dates match, the earliest due wins;
 * two tasks with the same identity and due date are ambiguous and stay unlinked.
 */
export function taskWork(
  task: AssignedTask,
  work: readonly LocalWork[],
  scope: {
    readonly visibleTasks: readonly AssignedTask[];
    /** The organization's convention (profile), the same for every row, as the server uses. */
    readonly epiWeek: string | null;
  },
): readonly LocalWork[] {
  const matches = (candidate: AssignedTask, entry: LocalWork) =>
    matchesCapture(candidate, entry, scope.epiWeek);
  return work.filter((entry) => {
    if (entry.taskId !== null) return entry.taskId === task.id;
    if (!matches(task, entry)) return false;
    const dues = scope.visibleTasks
      .filter((candidate) => matches(candidate, entry))
      .map((candidate) => candidate.date);
    const earliest = dues.reduce((min, due) => (due < min ? due : min), task.date);
    return task.date === earliest && dues.filter((due) => due === earliest).length === 1;
  });
}
