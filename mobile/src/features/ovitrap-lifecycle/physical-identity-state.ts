import { readInteger } from "../../db/sql.ts";
import type { SqlExecutor } from "../../db/sql.ts";
const ASSIGNED_IDENTITY = `SELECT json_extract(item.value,'$.point.id') AS point_id,
  COALESCE(json_extract(item.value,'$.isRetired'),0) AS is_retired
  FROM kv CROSS JOIN json_each(kv.value,'$.assignment.ovitraps') item
  WHERE kv.key='ovitrap_snapshots' AND json_extract(item.value,'$.id')=(SELECT id FROM identity) LIMIT 1`;
const LOCAL_RETIREMENT = `SELECT 1 FROM lifecycle_capture c JOIN outbox_event e ON e.id=c.event_id
  WHERE c.ovitrap_id=(SELECT id FROM identity) AND c.kind IN ('replace','remove')
  AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
  (SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id=v.event_id
   WHERE v.target_event_id=c.event_id AND ve.local_status NOT IN ('rejected','in_review'))`;
/** Single current-state rule for reads and transactional guards. Expressions are trusted SQL, never user values.
 * Downloaded physical state replaces assignment fallback; downloaded point retirement and current local effects apply.
 */
export function physicalIdentityStateSql({
  idSql,
  pointIdSql = "NULL",
}: {
  readonly idSql: string;
  readonly pointIdSql?: string;
}): string {
  return `(WITH identity AS (SELECT ${idSql} AS id), assigned AS (${ASSIGNED_IDENTITY}),
    downloaded AS (SELECT body FROM lifecycle_courier_projection WHERE kind='ovitrap' AND id=(SELECT id FROM identity)),
    resolved_point AS (SELECT COALESCE(
      (SELECT json_extract(body,'$.sampling_point_id') FROM downloaded),
      (SELECT point_id FROM assigned),
      (SELECT json_extract(draft,'$.point.id') FROM ovitrap_capture WHERE ovitrap_id=(SELECT id FROM identity) ORDER BY rowid LIMIT 1),
      (SELECT point_id FROM lifecycle_capture WHERE kind='replace' AND json_extract(draft,'$.replacementId')=(SELECT id FROM identity) ORDER BY rowid LIMIT 1),
      ${pointIdSql}) AS id)
    SELECT CASE WHEN EXISTS (${LOCAL_RETIREMENT}) OR
      CASE WHEN EXISTS (SELECT 1 FROM downloaded)
        THEN COALESCE((SELECT json_extract(body,'$.is_retired') OR json_extract(body,'$.placement_voided') FROM downloaded),0)
        ELSE COALESCE((SELECT is_retired FROM assigned),0) END
      OR EXISTS (SELECT 1 FROM lifecycle_courier_projection p JOIN resolved_point point ON p.id=point.id
        WHERE p.kind='sampling_point' AND json_extract(p.body,'$.is_retired')=1)
      THEN 1 ELSE 0 END)`;
}

/** Read the shared predicate with draft point context, including a not-yet-placed physical UUID. */
export async function readPhysicalIdentityState(
  db: SqlExecutor,
  { id, pointId = null }: { readonly id: string; readonly pointId?: string | null },
): Promise<{ readonly isRetired: boolean }> {
  const [row] = await db.query(
    `SELECT ${physicalIdentityStateSql({ idSql: "?", pointIdSql: "?" })} AS is_retired`,
    [id, pointId],
  );
  if (!row) throw new Error("Missing physical identity state.");
  return { isRetired: readInteger(row, "is_retired") === 1 };
}
