/** Additive file journal; event history remains in the existing outbox. */
export const ATTACHMENT_SCHEMA = [
  "CREATE INDEX ovitrap_evidence_uuid ON ovitrap_evidence(lower(evidence_id))",
  `CREATE INDEX outbox_pending_physical ON outbox_event(json_extract(payload,'$.ovitrap_id'),seq) WHERE local_status='pending'`,
  `CREATE TABLE attachment_context(slot INTEGER PRIMARY KEY CHECK(slot=1),owner_key TEXT,
    session_id TEXT,generation INTEGER NOT NULL DEFAULT 0,is_active INTEGER NOT NULL DEFAULT 0)`,
  "INSERT INTO attachment_context(slot) VALUES(1)",
  `CREATE TABLE attachment_file(id TEXT PRIMARY KEY NOT NULL,owner_key TEXT NOT NULL,
    draft_id TEXT NOT NULL,metadata TEXT,state TEXT NOT NULL DEFAULT 'adopting'
    CHECK(state IN ('adopting','ready','authorized','received','verified')),
    verified_at TEXT,is_bound INTEGER NOT NULL DEFAULT 0 CHECK(is_bound IN (0,1)),last_error TEXT,retry_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,attempt_version INTEGER NOT NULL DEFAULT 0)`,
  "CREATE INDEX attachment_file_due ON attachment_file(owner_key,state,retry_at)",
  "CREATE INDEX attachment_work ON attachment_file(owner_key,retry_at,attempts,id) WHERE state<>'verified' OR is_bound=0",
  `CREATE TRIGGER attachment_identity_immutable BEFORE UPDATE OF id,owner_key,draft_id ON attachment_file
    BEGIN SELECT RAISE(ABORT,'evidence identity is immutable'); END`,
  `CREATE TRIGGER attachment_metadata_immutable BEFORE UPDATE OF metadata ON attachment_file
    WHEN OLD.metadata IS NOT NULL BEGIN SELECT RAISE(ABORT,'evidence bytes are immutable'); END`,
  `CREATE TRIGGER attachment_retained BEFORE DELETE ON attachment_file
    BEGIN SELECT RAISE(ABORT,'evidence is retained'); END`,
  `CREATE TABLE attachment_event(evidence_id TEXT PRIMARY KEY NOT NULL REFERENCES attachment_file(id),
    event_id TEXT NOT NULL REFERENCES outbox_event(id))`,
  `CREATE TRIGGER attachment_event_immutable BEFORE UPDATE ON attachment_event
    BEGIN SELECT RAISE(ABORT,'evidence binding is immutable'); END`,
  `CREATE TRIGGER attachment_event_retained BEFORE DELETE ON attachment_event
    BEGIN SELECT RAISE(ABORT,'evidence binding is retained'); END`,
] as const;

/** The projection owner includes this in its own transaction, never a late callback. */
export const INVALIDATE_ATTACHMENTS = {
  sql: "UPDATE attachment_context SET generation=generation+1 WHERE slot=1",
} as const;
