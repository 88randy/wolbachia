import type { SqlExecutor } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import type { AssignedTask } from "./types.ts";
export interface TaskOwner {
  readonly courier: string;
  readonly pointId: string;
}
/** Actual current v3 assignment; retained payload, point/code fallback and unknown completion never enable action. */
export async function readCurrentTask(
  db: SqlExecutor,
  id: string,
  expected: TaskOwner,
): Promise<AssignedTask | null> {
  const [row] = await db.query(
    `SELECT payload FROM day_assignment WHERE id=? AND removed=0
    AND json_type(payload,'$.isCompleted')='false' AND json_extract(payload,'$.id')=?
    AND json_extract(payload,'$.courier')=? AND json_extract(payload,'$.point_id')=?`,
    [id, id, expected.courier, expected.pointId],
  );
  return row ? (JSON.parse(readText(row, "payload")) as AssignedTask) : null;
}
