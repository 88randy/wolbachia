/** Additive schema21: sample identity and authored evidence are retained under their original owner. */
export const SAMPLE_SCHEMA = [
  `CREATE TABLE sample_draft(id TEXT PRIMARY KEY NOT NULL, sample_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
    owner_key TEXT NOT NULL,draft TEXT NOT NULL,event_id TEXT UNIQUE REFERENCES outbox_event(id)
    CHECK(lower(id)<>lower(sample_id) AND json_extract(draft,'$.eventId')=id
      AND json_extract(draft,'$.sampleId')=sample_id AND json_extract(draft,'$.ownerKey')=owner_key
      AND (event_id IS NULL OR event_id=id)))`,
  `CREATE TRIGGER sample_owner_activation BEFORE UPDATE ON attachment_context
    WHEN NEW.is_active=1 AND EXISTS(SELECT 1 FROM sample_draft WHERE owner_key IS NOT NEW.owner_key)
    BEGIN SELECT RAISE(ABORT,'sample owner conflict'); END`,
  `CREATE TRIGGER sample_identity_immutable BEFORE UPDATE ON sample_draft
    WHEN NEW.id IS NOT OLD.id OR NEW.sample_id IS NOT OLD.sample_id OR NEW.owner_key IS NOT OLD.owner_key
      OR json_extract(NEW.draft,'$.source') IS NOT json_extract(OLD.draft,'$.source')
      OR json_extract(NEW.draft,'$.sourceRef') IS NOT json_extract(OLD.draft,'$.sourceRef')
      OR json_extract(NEW.draft,'$.shiftId') IS NOT json_extract(OLD.draft,'$.shiftId')
      OR json_extract(NEW.draft,'$.startedAt') IS NOT json_extract(OLD.draft,'$.startedAt')
      OR json_extract(NEW.draft,'$.timezone') IS NOT json_extract(OLD.draft,'$.timezone')
      OR json_extract(NEW.draft,'$.manualCapture') IS NOT json_extract(OLD.draft,'$.manualCapture')
      OR json_extract(NEW.draft,'$.captureVersion') IS NOT json_extract(OLD.draft,'$.captureVersion')
      OR json_extract(NEW.draft,'$.rulesVersion') IS NOT json_extract(OLD.draft,'$.rulesVersion')
      OR (NEW.event_id IS NULL AND json_extract(NEW.draft,'$.deviceTime') IS NOT json_extract(OLD.draft,'$.deviceTime'))
    BEGIN SELECT RAISE(ABORT,'sample identity is immutable'); END`,
  `CREATE TRIGGER sample_saved_immutable BEFORE UPDATE ON sample_draft
    WHEN OLD.event_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'sample observation is immutable'); END`,
  `CREATE TRIGGER sample_retained BEFORE DELETE ON sample_draft
    BEGIN SELECT RAISE(ABORT,'sample evidence is retained'); END`,
] as const;
