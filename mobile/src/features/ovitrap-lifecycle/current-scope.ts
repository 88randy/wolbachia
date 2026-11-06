import type { SqlStatement } from "../../db/sql.ts";
import {
  CAPTURE_SCOPE_AVAILABLE,
  mutateCaptureAuthority,
} from "../ovitrap-check/snapshot-authority.ts";
export { CAPTURE_SCOPE_AVAILABLE };
/** The live assignment alone authorizes a write; draft assignment is historical evidence. */
export function currentPointScopeSql(pointIdSql: string): string {
  return `SELECT 1 FROM kv,json_each(kv.value,'$.assignment.points') point
    WHERE kv.key='ovitrap_snapshots' AND ${CAPTURE_SCOPE_AVAILABLE} AND json_extract(point.value,'$.id')=${pointIdSql}`;
}
/** Invalidated canonical point data cannot leave a current capture grant behind. History is untouched. */
export function removeUnavailablePointScope(id: string): SqlStatement {
  return mutateCaptureAuthority({
    assignmentSql: `CASE WHEN json_type(kv.value,'$.assignment')='object' THEN
      json_set(json_extract(kv.value,'$.assignment'),'$.points',json(COALESCE(
      (SELECT json_group_array(json(point.value)) FROM json_each(kv.value,'$.assignment.points') point
        WHERE json_extract(point.value,'$.id')<>?),'[]'))) ELSE NULL END`,
    params: [id],
    when: {
      sql: "NOT EXISTS(SELECT 1 FROM day_sampling_point WHERE id=? AND removed=0)",
      params: [id],
    },
  });
}
/** Bootstrap can narrow known capture context, never invent its missing week/shift configuration. */
export function replaceCaptureScope(
  pointIds: readonly string[],
  physicalIds: readonly string[],
): SqlStatement {
  return mutateCaptureAuthority({
    assignmentSql: `CASE WHEN json_type(kv.value,'$.assignment')='object' THEN
      json_set(json_extract(kv.value,'$.assignment'),
      '$.points',json(COALESCE((SELECT json_group_array(json(point.value))
        FROM json_each(kv.value,'$.assignment.points') point
        WHERE json_extract(point.value,'$.id') IN (SELECT value FROM json_each(?))),'[]')),
      '$.ovitraps',json(COALESCE((SELECT json_group_array(json(trap.value))
        FROM json_each(kv.value,'$.assignment.ovitraps') trap
        WHERE json_extract(trap.value,'$.id') IN (SELECT value FROM json_each(?))),'[]'))) ELSE NULL END`,
    params: [JSON.stringify(pointIds), JSON.stringify(physicalIds)],
  });
}
export function revokeCaptureScope(): SqlStatement {
  return mutateCaptureAuthority({ assignmentSql: "NULL" });
}
