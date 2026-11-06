import type { SqlStatement } from "../../db/sql.ts";
export const CAPTURE_SCOPE_AVAILABLE = `NOT EXISTS(SELECT 1 FROM kv WHERE key='day_cleanup_pending' AND value='true')`;
/** The live assignment alone authorizes a write; draft assignment is historical evidence. */
export function currentPointScopeSql(pointIdSql: string): string {
  return `SELECT 1 FROM kv,json_each(kv.value,'$.assignment.points') point
    WHERE kv.key='ovitrap_snapshots' AND ${CAPTURE_SCOPE_AVAILABLE} AND json_extract(point.value,'$.id')=${pointIdSql}`;
}
/** Bootstrap can narrow known capture context, never invent its missing week/shift configuration. */
export function replaceCaptureScope(
  pointIds: readonly string[],
  physicalIds: readonly string[],
): SqlStatement {
  return {
    sql: `UPDATE kv SET value=json_set(value,
      '$.assignment.points',json(COALESCE((SELECT json_group_array(json(point.value))
        FROM json_each(kv.value,'$.assignment.points') point
        WHERE json_extract(point.value,'$.id') IN (SELECT value FROM json_each(?))),'[]')),
      '$.assignment.ovitraps',json(COALESCE((SELECT json_group_array(json(trap.value))
        FROM json_each(kv.value,'$.assignment.ovitraps') trap
        WHERE json_extract(trap.value,'$.id') IN (SELECT value FROM json_each(?))),'[]')))
      WHERE key='ovitrap_snapshots' AND json_type(value,'$.assignment')='object'`,
    params: [JSON.stringify(pointIds), JSON.stringify(physicalIds)],
  };
}
