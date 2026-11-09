/** Additive schema19 retains the original capture even without files or an operational shift. */
export const INCIDENT_SCHEMA = [
  `CREATE TABLE incident_draft(id TEXT PRIMARY KEY NOT NULL,owner_key TEXT NOT NULL,
    draft TEXT NOT NULL,event_id TEXT UNIQUE REFERENCES outbox_event(id))`,
  `CREATE UNIQUE INDEX incident_unfinished ON incident_draft(owner_key,json_extract(draft,'$.kind'),
    COALESCE(json_extract(draft,'$.shiftId'),'')) WHERE event_id IS NULL`,
  `CREATE TRIGGER incident_owner_activation BEFORE UPDATE ON attachment_context
    WHEN NEW.is_active=1 AND EXISTS(SELECT 1 FROM incident_draft WHERE owner_key IS NOT NEW.owner_key)
    BEGIN SELECT RAISE(ABORT,'incident owner conflict'); END`,
  `CREATE TRIGGER incident_identity_immutable BEFORE UPDATE ON incident_draft
    WHEN NEW.id IS NOT OLD.id OR NEW.owner_key IS NOT OLD.owner_key
      OR json_extract(NEW.draft,'$.eventId') IS NOT json_extract(OLD.draft,'$.eventId')
      OR json_extract(NEW.draft,'$.kind') IS NOT json_extract(OLD.draft,'$.kind')
      OR json_extract(NEW.draft,'$.shiftId') IS NOT json_extract(OLD.draft,'$.shiftId')
      OR json_extract(NEW.draft,'$.deviceTime') IS NOT json_extract(OLD.draft,'$.deviceTime')
      OR json_extract(NEW.draft,'$.rulesVersion') IS NOT json_extract(OLD.draft,'$.rulesVersion')
      OR json_extract(NEW.draft,'$.catalogVersion') IS NOT json_extract(OLD.draft,'$.catalogVersion')
    BEGIN SELECT RAISE(ABORT,'incident identity is immutable'); END`,
  `CREATE TRIGGER incident_saved_immutable BEFORE UPDATE ON incident_draft
    WHEN OLD.event_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'incident capture is immutable'); END`,
  `CREATE TRIGGER incident_retained BEFORE DELETE ON incident_draft
    BEGIN SELECT RAISE(ABORT,'incident capture is retained'); END`,
] as const;
