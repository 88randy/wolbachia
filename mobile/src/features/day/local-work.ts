import type { SqlExecutor } from "../../db/sql.ts";
import type { LocalWork, LocalWorkOverlay, AssignedTask } from "./types.ts";
/** [ASSUMPTION] #9 links task_id or ovitrap_id. Completion fallback uses the ISO capture day/action until
 * downloaded organization time-zone metadata is published. Retention is independently conservative. */
export class OutboxWorkOverlay implements LocalWorkOverlay {
  readonly #db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.#db = db;
  }
  async read(): Promise<readonly LocalWork[]> {
    const rows = await this.#db.query(`SELECT json_extract(payload,'$.task_id') AS task_id,
      json_extract(payload,'$.ovitrap_id') AS ovitrap_id, device_time, type, local_status FROM outbox_event WHERE type LIKE 'ovitrap.%'`);
    return rows.map((row) => ({
      taskId: typeof row.task_id === "string" ? row.task_id : null,
      ovitrapId: typeof row.ovitrap_id === "string" ? row.ovitrap_id : null,
      status: String(row.local_status),
      captureDate: String(row.device_time).slice(0, 10),
      action: String(row.type).replace("ovitrap.", ""),
    }));
  }
}
export function taskWork(task: AssignedTask, work: readonly LocalWork[]): readonly LocalWork[] {
  return work.filter((entry) => {
    if (entry.taskId !== null) return entry.taskId === task.id;
    return (
      task.ovitrap_id !== undefined &&
      entry.ovitrapId === task.ovitrap_id &&
      entry.captureDate === task.date &&
      entry.action === task.action
    );
  });
}
