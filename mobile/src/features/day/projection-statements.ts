import type { SqlStatement } from "../../db/sql.ts";
import type { AssignedTask, ProjectionChange, MapManifest } from "./types.ts";
import {
  PENDING_WORK,
  PENDING_RETAINED,
  PENDING_CURRENT,
  CURRENT_EVENT_IDS,
} from "./pending-work.ts";
const NEWER = `excluded.version != version AND
  (excluded.sequence = 0 OR excluded.sequence > sequence) AND
  (excluded.version GLOB '*[^0-9]*' OR version GLOB '*[^0-9]*' OR CAST(excluded.version AS INTEGER) > CAST(version AS INTEGER))`;
/** No change envelope means authoritative bootstrap replacement; deltas retain their version guard. */
export function upsertTask(task: AssignedTask, change?: ProjectionChange): SqlStatement {
  return {
    sql: `INSERT INTO day_assignment(id,version,sequence,payload,removed,kept) VALUES (?,?,?,?,0,0)
    ON CONFLICT(id) DO UPDATE SET version=excluded.version, sequence=excluded.sequence,
    kept=CASE WHEN ${PENDING_RETAINED} OR (${PENDING_CURRENT} AND payload != excluded.payload) THEN 1 ELSE 0 END,
    retained_event_ids=CASE WHEN ${PENDING_RETAINED} THEN retained_event_ids WHEN ${PENDING_CURRENT} AND payload != excluded.payload THEN ${CURRENT_EVENT_IDS} ELSE '[]' END,
    retained_payload=CASE WHEN ${PENDING_RETAINED} THEN retained_payload WHEN ${PENDING_CURRENT} AND payload != excluded.payload THEN payload ELSE NULL END,
    payload=excluded.payload,
    removed=0 WHERE ${change === undefined ? "1" : NEWER}`,
    params: [
      task.id,
      change?.resource_version ?? task.version,
      change?.sequence ?? 0,
      JSON.stringify(task),
    ],
  };
}
export function removeTask(change: ProjectionChange): SqlStatement {
  return {
    sql: `INSERT INTO day_assignment(id,version,sequence,payload,removed,kept) VALUES (?,?,?,NULL,1,0)
    ON CONFLICT(id) DO UPDATE SET version=excluded.version,sequence=excluded.sequence,removed=1,
    kept=CASE WHEN ${PENDING_WORK} THEN 1 ELSE 0 END WHERE ${NEWER}`,
    params: [change.resource_id, change.resource_version, change.sequence],
  };
}
export function removeMissingTasks(ids: readonly string[]): SqlStatement {
  return {
    sql: `UPDATE day_assignment SET removed=1, kept=CASE WHEN ${PENDING_WORK} THEN 1 ELSE 0 END
    WHERE id NOT IN (SELECT value FROM json_each(?))`,
    params: [JSON.stringify(ids)],
  };
}
/** Bootstrap restores present assets even at an equal version; only deltas deduplicate. */
export function upsertManifest(manifest: MapManifest, change?: ProjectionChange): SqlStatement {
  return {
    sql: `INSERT INTO day_map_manifest(id,version,sequence,payload,removed) VALUES (?,?,?,?,0)
    ON CONFLICT(id) DO UPDATE SET version=excluded.version,sequence=excluded.sequence,payload=excluded.payload,removed=0 WHERE ${change === undefined ? "1" : NEWER}`,
    params: [
      manifest.asset_id,
      change?.resource_version ?? manifest.version,
      change?.sequence ?? 0,
      JSON.stringify(manifest),
    ],
  };
}
export function removeManifest(change: ProjectionChange): SqlStatement {
  return {
    sql: `INSERT INTO day_map_manifest(id,version,sequence,payload,removed) VALUES (?,?,?,NULL,1)
    ON CONFLICT(id) DO UPDATE SET version=excluded.version,sequence=excluded.sequence,removed=1 WHERE ${NEWER}`,
    params: [change.resource_id, change.resource_version, change.sequence],
  };
}
