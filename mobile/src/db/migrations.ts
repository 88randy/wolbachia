import type { SqlExecutor, SqlStatement } from "./sql.ts";
import { readInteger } from "./sql.ts";

/**
 * Schema of the phone's database. Each entry is one migration; the position (1-based) is the
 * `PRAGMA user_version` it leaves behind. Never edit a released migration: append a new one.
 *
 * `outbox_event` mirrors the `FieldEvent` envelope of `docs/sync.md` plus the local columns
 * `local_status`, `attempts`, `last_error` and the server's answer (`result_code`, `result_params`).
 * Nothing is deleted and the envelope never changes after the insert (triggers below), which is
 * what "records are immutable" means on the phone.
 */
// Migration 6 snapshots event references without putting projection writes in receipt settlement.
const ENROLLED_RETAINED_EVENTS = `SELECT json_group_array(e.id) FROM outbox_event e
  WHERE e.local_status IN ('pending','sending','error','in_review') AND
    (json_extract(e.payload,'$.task_id')=day_assignment.id OR
     (json_extract(e.payload,'$.task_id') IS NULL AND
      json_extract(e.payload,'$.ovitrap_id')=json_extract(day_assignment.retained_payload,'$.ovitrap_id')))`;
const ENROLL_VISIBLE_CAPTURE = `CREATE TRIGGER day_enroll_retained_capture AFTER INSERT ON outbox_event
  BEGIN UPDATE day_assignment SET retained_event_ids=json_insert(retained_event_ids,'$[#]',NEW.id)
  WHERE kept=1 AND retained_payload IS NOT NULL AND EXISTS
    (SELECT 1 FROM outbox_event e WHERE e.local_status IN ('pending','sending','error','in_review')
      AND e.id IN (SELECT value FROM json_each(day_assignment.retained_event_ids)))
    AND (json_extract(NEW.payload,'$.task_id')=day_assignment.id OR
      (json_extract(NEW.payload,'$.task_id') IS NULL AND
       json_extract(NEW.payload,'$.ovitrap_id')=json_extract(day_assignment.retained_payload,'$.ovitrap_id')));
  END`;

const MIGRATIONS: readonly (readonly string[])[] = [
  [
    `CREATE TABLE kv (
       key TEXT PRIMARY KEY NOT NULL,
       value TEXT NOT NULL
     )`,
    `CREATE TABLE outbox_event (
       seq INTEGER PRIMARY KEY AUTOINCREMENT,
       id TEXT NOT NULL UNIQUE,
       type TEXT NOT NULL,
       schema_version INTEGER NOT NULL,
       device_time TEXT NOT NULL,
       payload TEXT NOT NULL,
       shift_id TEXT,
       gps TEXT,
       rules_version TEXT NOT NULL,
       catalog_version TEXT NOT NULL,
       manual_capture INTEGER NOT NULL DEFAULT 0,
       voids_event_id TEXT,
       local_status TEXT NOT NULL DEFAULT 'pending'
         CHECK (local_status IN ('pending', 'sending', 'sent', 'error', 'in_review', 'rejected')),
       attempts INTEGER NOT NULL DEFAULT 0,
       last_error TEXT,
       result_code TEXT,
       result_params TEXT,
       updated_at TEXT NOT NULL
     )`,
    "CREATE INDEX outbox_event_status_seq ON outbox_event (local_status, seq)",
    `CREATE TRIGGER outbox_event_no_delete BEFORE DELETE ON outbox_event
     BEGIN SELECT RAISE(ABORT, 'outbox events are never deleted'); END`,
    `CREATE TRIGGER outbox_event_envelope_immutable
     BEFORE UPDATE OF id, type, schema_version, device_time, payload, shift_id, gps,
       rules_version, catalog_version, manual_capture, voids_event_id ON outbox_event
     BEGIN SELECT RAISE(ABORT, 'the event envelope never changes'); END`,
  ],
  ["ALTER TABLE outbox_event ADD COLUMN retry_at TEXT"],
  [
    `CREATE TABLE shift_open_state (
      slot INTEGER PRIMARY KEY CHECK (slot = 1),
      draft TEXT NOT NULL,
      opening_event_id TEXT UNIQUE REFERENCES outbox_event(id)
    )`,
    `CREATE TRIGGER shift_open_captured_immutable BEFORE UPDATE ON shift_open_state
      WHEN OLD.opening_event_id IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'a captured shift is immutable'); END`,
    `CREATE TRIGGER shift_open_no_delete BEFORE DELETE ON shift_open_state
      BEGIN SELECT RAISE(ABORT, 'shift evidence is never deleted'); END`,
  ],
  [
    "DROP TRIGGER shift_open_captured_immutable",
    `CREATE TRIGGER shift_open_captured_immutable BEFORE UPDATE ON shift_open_state
      WHEN OLD.opening_event_id IS NOT NULL AND (
        NEW.opening_event_id IS NOT NULL OR NOT EXISTS
        (SELECT 1 FROM outbox_event WHERE id = OLD.opening_event_id AND local_status = 'rejected'))
      BEGIN SELECT RAISE(ABORT, 'a captured shift is immutable unless rejected'); END`,
  ],
  [
    `CREATE TABLE day_assignment (id TEXT PRIMARY KEY NOT NULL, version TEXT NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0, payload TEXT, retained_payload TEXT, removed INTEGER NOT NULL DEFAULT 0, kept INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE day_map_manifest (id TEXT PRIMARY KEY NOT NULL, version TEXT NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0, payload TEXT, removed INTEGER NOT NULL DEFAULT 0)`,
    "CREATE TABLE day_bundle_meta (slot INTEGER PRIMARY KEY CHECK(slot=1), payload TEXT NOT NULL)",
  ],
  [
    "ALTER TABLE day_assignment ADD COLUMN retained_event_ids TEXT NOT NULL DEFAULT '[]'",
    `UPDATE day_assignment SET retained_event_ids=(${ENROLLED_RETAINED_EVENTS}) WHERE retained_payload IS NOT NULL`,
    "UPDATE day_assignment SET retained_payload=NULL,kept=0 WHERE retained_payload IS NOT NULL AND retained_event_ids='[]' AND removed=0",
    ENROLL_VISIBLE_CAPTURE,
  ],
];

/** Highest schema version this build knows. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/** Applies the migrations the database has not seen yet, each one atomically with its version. */
export async function migrate(db: SqlExecutor): Promise<void> {
  const rows = await db.query("PRAGMA user_version");
  const current = rows[0] === undefined ? 0 : readInteger(rows[0], "user_version");
  for (const [index, statements] of MIGRATIONS.entries()) {
    const version = index + 1;
    if (version <= current) continue;
    const steps: SqlStatement[] = statements.map((sql) => ({ sql }));
    steps.push({ sql: `PRAGMA user_version = ${String(version)}` });
    await db.runAtomically(steps);
  }
}
