import { currentPointScopeSql } from "../features/ovitrap-lifecycle/current-scope.ts";
import { INCIDENT_SCHEMA } from "../features/incidents/schema.ts";
import {
  IDENTITY_EFFECTS,
  RECEIPT_EFFECTS,
} from "../features/ovitrap-lifecycle/identity-effects.ts";
import { physicalIdentityStateSql } from "../features/ovitrap-lifecycle/physical-identity-state.ts";
import type { SqlExecutor, SqlStatement } from "./sql.ts";
import { KV_KEYS } from "./kv-store.ts";
import { ATTACHMENT_SCHEMA } from "../attachments/schema.ts";
import { schemaProfiles } from "./schema-profile.ts";
import { LIFECYCLE_CONTEXT_SCHEMA } from "../features/ovitrap-lifecycle/context-schema.ts";
import { inspectSchemaLineage } from "./schema-lineage.ts";
import { LIFECYCLE_EVIDENCE_SCHEMA } from "../features/ovitrap-lifecycle/evidence-schema.ts";
import { SUPPLY_RECEIPT_SCHEMA } from "../features/supply-receipt/schema.ts";
import { FUEL_SCHEMA } from "../features/fuel/schema.ts";
import { RELEASE_SCHEMA } from "../features/releases/schema.ts";
import { SAMPLE_SCHEMA } from "../features/samples/schema.ts";

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
    `CREATE TABLE ovitrap_draft (slot INTEGER PRIMARY KEY CHECK(slot = 1), draft TEXT NOT NULL, event_id TEXT REFERENCES outbox_event(id))`,
    `CREATE TABLE ovitrap_capture (event_id TEXT PRIMARY KEY REFERENCES outbox_event(id), ovitrap_id TEXT NOT NULL, mode TEXT NOT NULL, epi_week TEXT NOT NULL, draft TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX ovitrap_placed_identity ON ovitrap_capture(ovitrap_id) WHERE mode = 'place'`,
    `CREATE TABLE ovitrap_evidence (event_id TEXT NOT NULL REFERENCES outbox_event(id), evidence_id TEXT NOT NULL, file_ref TEXT NOT NULL, PRIMARY KEY(event_id, evidence_id))`,
    `CREATE TABLE ovitrap_lineage (void_event_id TEXT PRIMARY KEY REFERENCES outbox_event(id), target_event_id TEXT NOT NULL UNIQUE REFERENCES outbox_event(id), replacement_event_id TEXT NOT NULL UNIQUE REFERENCES outbox_event(id) DEFERRABLE INITIALLY DEFERRED)`,
    `CREATE TRIGGER ovitrap_capture_slot BEFORE INSERT ON ovitrap_capture WHEN NOT EXISTS
      (SELECT 1 FROM ovitrap_draft WHERE slot = 1 AND event_id IS NULL AND json_extract(draft, '$.eventId') = NEW.event_id)
      BEGIN SELECT RAISE(ABORT, 'draft changed or already captured'); END`,
    `CREATE TRIGGER ovitrap_week_unique BEFORE INSERT ON ovitrap_capture WHEN NEW.mode = 'check' AND EXISTS
      (SELECT 1 FROM ovitrap_capture c WHERE c.mode = 'check' AND c.ovitrap_id = NEW.ovitrap_id AND c.epi_week = NEW.epi_week
      AND NOT EXISTS (SELECT 1 FROM ovitrap_lineage l WHERE l.target_event_id = c.event_id))
      BEGIN SELECT RAISE(ABORT, 'active reading already exists this epi week'); END`,
    ...["ovitrap_capture", "ovitrap_evidence", "ovitrap_lineage"].flatMap((table) => [
      `CREATE TRIGGER ${table}_immutable BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'capture evidence is immutable'); END`,
      `CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'capture evidence is retained'); END`,
    ]),
  ],
  [
    `CREATE TABLE ovitrap_superseded_draft (event_id TEXT PRIMARY KEY NOT NULL, replacement_event_id TEXT NOT NULL UNIQUE, draft TEXT NOT NULL)`,
    `CREATE TRIGGER ovitrap_superseded_draft_immutable BEFORE UPDATE ON ovitrap_superseded_draft
      BEGIN SELECT RAISE(ABORT, 'superseded draft evidence is immutable'); END`,
    `CREATE TRIGGER ovitrap_superseded_draft_no_delete BEFORE DELETE ON ovitrap_superseded_draft
      BEGIN SELECT RAISE(ABORT, 'superseded draft evidence is retained'); END`,
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
  [
    `CREATE TABLE day_sampling_point(id TEXT PRIMARY KEY NOT NULL,version INTEGER NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0,payload TEXT,removed INTEGER NOT NULL DEFAULT 0 CHECK(removed IN (0,1)))`,
    `INSERT INTO kv(key,value) VALUES('${KV_KEYS.daySamplingPointsBootstrapPending}','true')`,
  ],
  ATTACHMENT_SCHEMA,
  [`INSERT INTO kv(key,value) VALUES('${KV_KEYS.dayCompletionBootstrapPending}','true')`],
  [
    `CREATE TABLE lifecycle_courier_projection (kind TEXT NOT NULL, id TEXT NOT NULL, version TEXT NOT NULL, sequence INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id))`,
    `CREATE TABLE lifecycle_guard (slot INTEGER PRIMARY KEY CHECK(slot = 1), value INTEGER NOT NULL CHECK(value = 1))`,
    `CREATE TABLE lifecycle_draft (slot INTEGER PRIMARY KEY CHECK(slot = 1), draft TEXT NOT NULL, event_id TEXT REFERENCES outbox_event(id))`,
    `CREATE TABLE lifecycle_archive (event_id TEXT PRIMARY KEY, draft TEXT NOT NULL)`,
    `CREATE TABLE lifecycle_identity (id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE)`,
    `CREATE TABLE lifecycle_capture (event_id TEXT PRIMARY KEY REFERENCES outbox_event(id), ovitrap_id TEXT NOT NULL, point_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('replace','relocate','remove')), draft TEXT NOT NULL)`,
    `CREATE TABLE lifecycle_evidence (event_id TEXT NOT NULL REFERENCES outbox_event(id), evidence_id TEXT NOT NULL, file_ref TEXT NOT NULL, PRIMARY KEY(event_id,evidence_id))`,
    `CREATE TABLE lifecycle_void (event_id TEXT PRIMARY KEY REFERENCES outbox_event(id), target_event_id TEXT NOT NULL REFERENCES lifecycle_capture(event_id), reason_code TEXT NOT NULL, reason TEXT NOT NULL)`,
    `CREATE TABLE lifecycle_decision (id TEXT PRIMARY KEY, proposal_event_id TEXT NOT NULL REFERENCES lifecycle_capture(event_id), decided_at TEXT NOT NULL, decision TEXT NOT NULL)`,
    `CREATE TRIGGER lifecycle_capture_slot BEFORE INSERT ON lifecycle_capture WHEN NOT EXISTS
      (SELECT 1 FROM lifecycle_draft WHERE slot = 1 AND event_id IS NULL AND json_extract(draft,'$.eventId') = NEW.event_id)
      BEGIN SELECT RAISE(ABORT, 'lifecycle draft changed or captured'); END`,
    `CREATE TRIGGER lifecycle_identity_unused BEFORE INSERT ON lifecycle_identity WHEN EXISTS
      (SELECT 1 FROM ovitrap_capture WHERE ovitrap_id = NEW.id)
      BEGIN SELECT RAISE(ABORT, 'physical identity already used'); END`,
    `CREATE TRIGGER lifecycle_source_active BEFORE INSERT ON lifecycle_capture WHEN EXISTS
      (SELECT 1 FROM lifecycle_capture c JOIN outbox_event e ON e.id = c.event_id
       WHERE c.ovitrap_id = NEW.ovitrap_id AND c.kind IN ('replace','remove')
       AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
       (SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id = v.event_id
        WHERE v.target_event_id = c.event_id AND ve.local_status NOT IN ('rejected','in_review')))
      BEGIN SELECT RAISE(ABORT, 'physical identity is retired'); END`,
    `CREATE TRIGGER ovitrap_lifecycle_active BEFORE INSERT ON ovitrap_capture WHEN EXISTS
      (SELECT 1 FROM lifecycle_capture c JOIN outbox_event e ON e.id = c.event_id
       WHERE c.ovitrap_id = NEW.ovitrap_id AND c.kind IN ('replace','remove')
       AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
       (SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id = v.event_id
        WHERE v.target_event_id = c.event_id AND ve.local_status NOT IN ('rejected','in_review')))
      BEGIN SELECT RAISE(ABORT, 'physical identity is retired'); END`,
    `CREATE TRIGGER lifecycle_void_once BEFORE INSERT ON lifecycle_void WHEN EXISTS
      (SELECT 1 FROM lifecycle_void v JOIN outbox_event e ON e.id=v.event_id WHERE v.target_event_id=NEW.target_event_id AND e.local_status <> 'rejected')
      BEGIN SELECT RAISE(ABORT, 'a correction is already pending or applied'); END`,
    `CREATE VIEW lifecycle_active_identity AS
      WITH candidates AS (
        SELECT c.ovitrap_id AS id,json_extract(c.draft,'$.point.id') AS point_id
        FROM ovitrap_capture c JOIN outbox_event e ON e.id=c.event_id WHERE c.mode='place'
          AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
          (SELECT 1 FROM ovitrap_lineage l WHERE l.target_event_id=c.event_id)
        UNION
        SELECT json_extract(c.draft,'$.replacementId'),c.point_id FROM lifecycle_capture c JOIN outbox_event e ON e.id=c.event_id
          WHERE c.kind='replace' AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
          (SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id=v.event_id
            WHERE v.target_event_id=c.event_id AND ve.local_status NOT IN ('rejected','in_review'))
        UNION
        SELECT id,json_extract(body,'$.sampling_point_id') FROM lifecycle_courier_projection WHERE kind='ovitrap'
          AND COALESCE(json_extract(body,'$.is_retired'),0)=0 AND json_extract(body,'$.placement_voided')=0
      ) SELECT id,point_id FROM candidates candidate WHERE NOT EXISTS
        (SELECT 1 FROM lifecycle_capture retired JOIN outbox_event re ON re.id=retired.event_id
          WHERE retired.ovitrap_id=candidate.id AND retired.kind IN ('replace','remove') AND re.local_status NOT IN ('rejected','in_review')
          AND NOT EXISTS(SELECT 1 FROM lifecycle_void rv JOIN outbox_event rve ON rve.id=rv.event_id
            WHERE rv.target_event_id=retired.event_id AND rve.local_status NOT IN ('rejected','in_review')))`,
    `CREATE TRIGGER lifecycle_remove_void_occupancy BEFORE INSERT ON lifecycle_void WHEN EXISTS
      (SELECT 1 FROM lifecycle_capture removed JOIN lifecycle_active_identity active ON active.point_id=removed.point_id
        WHERE removed.event_id=NEW.target_event_id AND removed.kind='remove' AND active.id<>removed.ovitrap_id)
      BEGIN SELECT RAISE(ABORT, 'a competing identity prevents removal correction'); END`,
    `CREATE TRIGGER ovitrap_lifecycle_identity_unused BEFORE INSERT ON ovitrap_capture WHEN NEW.mode='place' AND EXISTS
      (SELECT 1 FROM lifecycle_identity WHERE id=NEW.ovitrap_id)
      BEGIN SELECT RAISE(ABORT, 'physical identity already reserved'); END`,
    `CREATE TRIGGER lifecycle_void_dependencies BEFORE INSERT ON lifecycle_void WHEN EXISTS
      (SELECT 1 FROM lifecycle_decision WHERE proposal_event_id = NEW.target_event_id)
      OR EXISTS (SELECT 1 FROM lifecycle_capture c JOIN lifecycle_capture dependent
        ON dependent.ovitrap_id = json_extract(c.draft,'$.replacementId')
        WHERE c.event_id = NEW.target_event_id AND c.kind = 'replace')
      OR EXISTS (SELECT 1 FROM lifecycle_capture c JOIN ovitrap_capture dependent
        ON dependent.ovitrap_id = json_extract(c.draft,'$.replacementId')
        WHERE c.event_id = NEW.target_event_id AND c.kind = 'replace')
      BEGIN SELECT RAISE(ABORT, 'lifecycle dependents prevent correction'); END`,
    ...[
      "lifecycle_archive",
      "lifecycle_identity",
      "lifecycle_capture",
      "lifecycle_evidence",
      "lifecycle_void",
      "lifecycle_decision",
    ].flatMap((table) => [
      `CREATE TRIGGER ${table}_immutable BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'lifecycle history is immutable'); END`,
      `CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'lifecycle history is retained'); END`,
    ]),
    `CREATE TRIGGER lifecycle_draft_no_delete BEFORE DELETE ON lifecycle_draft BEGIN SELECT RAISE(ABORT, 'lifecycle draft is retained'); END`,
  ],
  [
    "DROP TRIGGER ovitrap_lifecycle_active",
    "DROP TRIGGER lifecycle_source_active",
    ...["ovitrap_capture", "lifecycle_capture"].map(
      (table) =>
        `CREATE TRIGGER ${table}_current_identity BEFORE INSERT ON ${table}
       WHEN ${physicalIdentityStateSql({ idSql: "NEW.ovitrap_id", pointIdSql: "json_extract(NEW.draft,'$.point.id')" })}=1
       BEGIN SELECT RAISE(ABORT, 'physical identity or point is retired'); END`,
    ),
    "DROP VIEW lifecycle_active_identity",
    `CREATE VIEW lifecycle_active_identity AS
      WITH candidates AS (
        SELECT c.ovitrap_id AS id,json_extract(c.draft,'$.point.id') AS point_id
        FROM ovitrap_capture c JOIN outbox_event e ON e.id=c.event_id WHERE c.mode='place'
          AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
          (SELECT 1 FROM ovitrap_lineage l WHERE l.target_event_id=c.event_id)
        UNION
        SELECT json_extract(c.draft,'$.replacementId'),c.point_id FROM lifecycle_capture c JOIN outbox_event e ON e.id=c.event_id
          WHERE c.kind='replace' AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
          (SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id=v.event_id
            WHERE v.target_event_id=c.event_id AND ve.local_status NOT IN ('rejected','in_review'))
        UNION
        SELECT id,json_extract(body,'$.sampling_point_id') FROM lifecycle_courier_projection WHERE kind='ovitrap'
        UNION
        SELECT json_extract(item.value,'$.id'),json_extract(item.value,'$.point.id')
          FROM kv CROSS JOIN json_each(kv.value,'$.assignment.ovitraps') item WHERE kv.key='ovitrap_snapshots'
      ) SELECT id,point_id FROM candidates candidate
        WHERE ${physicalIdentityStateSql({ idSql: "candidate.id", pointIdSql: "candidate.point_id" })}=0`,
  ],
  [
    `CREATE VIEW lifecycle_identity_effect AS ${IDENTITY_EFFECTS}`,
    `CREATE TABLE lifecycle_receipt(event_id TEXT NOT NULL REFERENCES outbox_event(id),ovitrap_id TEXT NOT NULL,
      projection_sequence INTEGER NOT NULL,is_reconciled INTEGER NOT NULL DEFAULT 0 CHECK(is_reconciled IN (0,1)),PRIMARY KEY(event_id,ovitrap_id))`,
    `${RECEIPT_EFFECTS} JOIN outbox_event e ON e.id=effect.event_id WHERE e.local_status='sent'`,
    `CREATE TRIGGER lifecycle_acknowledged_effect AFTER UPDATE OF local_status ON outbox_event
      WHEN NEW.local_status='sent' AND OLD.local_status<>'sent'
      BEGIN ${RECEIPT_EFFECTS} WHERE effect.event_id=NEW.id; END`,
    "DROP TRIGGER ovitrap_capture_current_identity",
    "DROP TRIGGER lifecycle_capture_current_identity",
    ...["ovitrap_capture", "lifecycle_capture"].map(
      (table) =>
        `CREATE TRIGGER ${table}_current_identity BEFORE INSERT ON ${table}
       WHEN ${physicalIdentityStateSql({ idSql: "NEW.ovitrap_id", pointIdSql: "json_extract(NEW.draft,'$.point.id')" })}=1
       BEGIN SELECT RAISE(ABORT, 'physical identity or point is retired'); END`,
    ),
    "DROP VIEW lifecycle_active_identity",
    `CREATE VIEW lifecycle_active_identity AS
      WITH candidates AS (
        SELECT c.ovitrap_id AS id,json_extract(c.draft,'$.point.id') AS point_id
        FROM ovitrap_capture c JOIN outbox_event e ON e.id=c.event_id WHERE c.mode='place'
          AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
          (SELECT 1 FROM ovitrap_lineage l WHERE l.target_event_id=c.event_id)
        UNION
        SELECT json_extract(c.draft,'$.replacementId'),c.point_id FROM lifecycle_capture c JOIN outbox_event e ON e.id=c.event_id
          WHERE c.kind='replace' AND e.local_status NOT IN ('rejected','in_review') AND NOT EXISTS
          (SELECT 1 FROM lifecycle_void v JOIN outbox_event ve ON ve.id=v.event_id
            WHERE v.target_event_id=c.event_id AND ve.local_status NOT IN ('rejected','in_review'))
        UNION
        SELECT id,json_extract(body,'$.sampling_point_id') FROM lifecycle_courier_projection WHERE kind='ovitrap'
        UNION
        SELECT json_extract(item.value,'$.id'),json_extract(item.value,'$.point.id')
          FROM kv CROSS JOIN json_each(kv.value,'$.assignment.ovitraps') item WHERE kv.key='ovitrap_snapshots'
      ) SELECT id,point_id FROM candidates candidate
        WHERE ${physicalIdentityStateSql({ idSql: "candidate.id", pointIdSql: "candidate.point_id" })}=0`,
    ...["ovitrap_capture", "lifecycle_capture"].map(
      (table) =>
        `CREATE TRIGGER ${table}_current_scope BEFORE INSERT ON ${table}
       WHEN NOT EXISTS(${currentPointScopeSql("json_extract(NEW.draft,'$.point.id')")})
       BEGIN SELECT RAISE(ABORT,'current downloaded scope no longer grants this point'); END`,
    ),
    `CREATE TRIGGER lifecycle_void_current_scope BEFORE INSERT ON lifecycle_void
      WHEN NOT EXISTS(SELECT 1 FROM lifecycle_capture c WHERE c.event_id=NEW.target_event_id
        AND EXISTS(${currentPointScopeSql("c.point_id")}))
      BEGIN SELECT RAISE(ABORT,'current downloaded scope no longer grants this correction'); END`,
  ],
  LIFECYCLE_CONTEXT_SCHEMA,
  LIFECYCLE_EVIDENCE_SCHEMA,
  SUPPLY_RECEIPT_SCHEMA,
  FUEL_SCHEMA,
  INCIDENT_SCHEMA,
  RELEASE_SCHEMA,
  SAMPLE_SCHEMA,
];

/** Highest schema version this build knows. */
export const SCHEMA_VERSION = MIGRATIONS.length;

/** @internal Released statements are also the sole source of structural prefix profiles. */
export const CANONICAL_MIGRATIONS = MIGRATIONS;
const LINEAGE_PROFILES = schemaProfiles(MIGRATIONS);

export function assertCanonicalDatabaseLineage(db: SqlExecutor): Promise<number> {
  return inspectSchemaLineage(db, LINEAGE_PROFILES);
}

/** Applies the migrations the database has not seen yet, each one atomically with its version. */
export async function migrate(db: SqlExecutor): Promise<void> {
  const current = await assertCanonicalDatabaseLineage(db);
  for (const [index, statements] of MIGRATIONS.entries()) {
    const version = index + 1;
    if (version <= current) continue;
    const steps: SqlStatement[] = statements.map((sql) => ({ sql }));
    steps.push({ sql: `PRAGMA user_version = ${String(version)}` });
    await db.runAtomically(steps);
  }
}
