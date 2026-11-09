import type { SqlStatement, SqlValue } from "../../db/sql.ts";
import type { Snapshots } from "./store.ts";

export const CAPTURE_SCOPE_AVAILABLE = `NOT EXISTS(SELECT 1 FROM kv WHERE key='day_cleanup_pending' AND value='true')`;
export const AUTHORITY_REVISION = "COALESCE(json_extract(value,'$.authorityRevision'),0)";
export interface AssignmentAuthority {
  readonly revision: number;
}
export class StaleAssignmentAuthorityError extends Error {
  constructor() {
    super("Capture assignment authority changed or contains an unavailable point.");
    this.name = "StaleAssignmentAuthorityError";
  }
}
interface AuthorityMutation {
  readonly assignmentSql: string;
  readonly params?: readonly SqlValue[];
  readonly when?: SqlStatement;
}
/** All scope writers advance the same revision in their transaction, including an absent/null authority. SQL is trusted. */
export function mutateCaptureAuthority(input: AuthorityMutation): SqlStatement {
  return {
    sql: `INSERT INTO kv(key,value) SELECT 'ovitrap_snapshots',
      json_object('catalog',NULL,'rules',NULL,'assignment',NULL,'authorityRevision',1)
      WHERE ${input.when?.sql ?? "1"}
      ON CONFLICT(key) DO UPDATE SET value=json_set(kv.value,
        '$.assignment',json(${input.assignmentSql}),'$.authorityRevision',${AUTHORITY_REVISION}+1)`,
    params: [...(input.when?.params ?? []), ...(input.params ?? [])],
  };
}
/** Configuration never accepts an assignment copy or rewrites authority metadata. */
export function configurationStatement(
  snapshots: Pick<Snapshots, "catalog" | "rules">,
): SqlStatement {
  return {
    sql: `INSERT INTO kv(key,value) VALUES('ovitrap_snapshots',?)
      ON CONFLICT(key) DO UPDATE SET value=json_set(kv.value,
        '$.catalog',json_extract(excluded.value,'$.catalog'),'$.rules',json_extract(excluded.value,'$.rules'))`,
    params: [
      JSON.stringify({
        catalog: snapshots.catalog,
        rules: snapshots.rules,
        assignment: null,
        authorityRevision: 0,
      }),
    ],
  };
}
/** The provider's revision is captured before download. One guarded SQL write publishes both data and revision. */
export function assignmentPublication(
  snapshots: Snapshots,
  authority: AssignmentAuthority,
): SqlStatement {
  return {
    sql: `WITH incoming(value) AS (SELECT ?) INSERT INTO kv(key,value)
      SELECT 'ovitrap_snapshots',incoming.value FROM incoming
      WHERE COALESCE((SELECT ${AUTHORITY_REVISION} FROM kv WHERE key='ovitrap_snapshots'),0)=?
        AND ${CAPTURE_SCOPE_AVAILABLE} AND NOT EXISTS(
          SELECT 1 FROM json_each(incoming.value,'$.assignment.points') point
          JOIN day_sampling_point current ON current.id=json_extract(point.value,'$.id') WHERE current.removed=1)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value RETURNING key`,
    params: [
      JSON.stringify({ ...snapshots, authorityRevision: authority.revision + 1 }),
      authority.revision,
    ],
  };
}
