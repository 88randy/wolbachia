import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import type { FuelCaptureSource } from "../fuel/capture-context.ts";
import { IncidentError } from "./domain.ts";

export interface IncidentAuthority {
  readonly guard: SqlStatement;
  readonly signature: string;
  readonly canRead: boolean;
  readonly canCreate: boolean;
  readonly canUpload: boolean;
}
/** Field scope and the accepted profile are one original SQL predicate, not grants inferred from GPS. */
export async function readIncidentAuthority(
  db: SqlExecutor,
  source: FuelCaptureSource,
): Promise<IncidentAuthority> {
  const [row] = await db.query(`SELECT profile.value AS value,
    EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='incident.create') AS can_create,
    EXISTS(SELECT 1 FROM json_each(profile.value,'$.permissions') WHERE value='incident.read') AS can_read
    FROM kv profile WHERE profile.key='session_profile'`);
  if (!row) throw new IncidentError("scope");
  const profile = readText(row, "value");
  const guard = {
    sql: `SELECT 1 WHERE EXISTS(${source.guard.sql}) AND EXISTS(SELECT 1 FROM kv WHERE key='session_profile' AND value=?)`,
    params: [...(source.guard.params ?? []), profile],
  };
  return {
    guard,
    signature: JSON.stringify([source.handle.sessionId, source.handle.scopeRevision, profile]),
    canRead: row.can_read === 1,
    canCreate: row.can_create === 1,
    canUpload: source.canUpload,
  };
}
