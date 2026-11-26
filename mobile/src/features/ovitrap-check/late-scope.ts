import { capturePointScopeSql } from "../ovitrap-lifecycle/context-sql.ts";
import { currentPointScopeSql } from "../ovitrap-lifecycle/current-scope.ts";

/**
 * The narrow exception for a capture the courier confirmed was made before its shift closed
 * ("Sí la hice ese día"). It never replaces the normal scope check; it adds a second way through,
 * and only when ALL of this holds, read from the draft itself and from durable local facts:
 *  - the draft is marked late;
 *  - its point is in the assignment snapshot it was STARTED with (not today's);
 *  - its own shift has a local `shift.close` at or after the draft's original device time;
 *  - the point still has a current grant in the downloaded capture context, is not removed or
 *    retired (a closed quadrant is allowed: that is what "late" means).
 * The server revalidates and puts the event in review.
 *
 * @param draftSql SQL expression of the draft JSON (`NEW.draft` in the trigger).
 */
export function lateCaptureScopeSql(draftSql: string): string {
  const point = `json_extract(${draftSql},'$.point.id')`;
  return `SELECT 1 WHERE json_extract(${draftSql},'$.isLate')=1
    AND EXISTS(SELECT 1 FROM json_each(${draftSql},'$.assignment.points') own
      WHERE json_extract(own.value,'$.id')=${point})
    AND EXISTS(SELECT 1 FROM outbox_event close WHERE close.type='shift.close'
      AND close.shift_id=json_extract(${draftSql},'$.shiftId')
      AND julianday(close.device_time)>=julianday(json_extract(${draftSql},'$.deviceTime')))
    AND EXISTS(${capturePointScopeSql(point, false)})`;
}

/**
 * The save trigger as a query, for the choice screen: would this old draft be let through, either
 * as a normal capture (point in today's scope) or as a late one?
 */
export function lateScopeQuery(): string {
  const point = "json_extract((SELECT draft FROM d),'$.point.id')";
  return `WITH d(draft) AS (SELECT json_set(?,'$.isLate',json('true')))
    SELECT (EXISTS(${currentPointScopeSql(point)}) AND EXISTS(${capturePointScopeSql(point)}))
      OR EXISTS(${lateCaptureScopeSql("(SELECT draft FROM d)")}) AS ok`;
}
