/** Additive schema18: authored drafts retain ownership even before a receipt exists. */
export const FUEL_SCHEMA = [
  `CREATE TABLE fuel_draft(id TEXT PRIMARY KEY NOT NULL, owner_key TEXT NOT NULL,
    draft TEXT NOT NULL, event_id TEXT UNIQUE REFERENCES outbox_event(id))`,
  `CREATE UNIQUE INDEX fuel_unfinished_shift ON fuel_draft(owner_key,json_extract(draft,'$.shiftId')) WHERE event_id IS NULL`,
  `CREATE TRIGGER fuel_owner_activation BEFORE UPDATE ON attachment_context
    WHEN NEW.is_active=1 AND EXISTS(SELECT 1 FROM fuel_draft WHERE owner_key IS NOT NEW.owner_key)
    BEGIN SELECT RAISE(ABORT,'fuel owner conflict'); END`,
  `CREATE TRIGGER fuel_identity_immutable BEFORE UPDATE ON fuel_draft
    WHEN NEW.id IS NOT OLD.id OR NEW.owner_key IS NOT OLD.owner_key
      OR json_extract(NEW.draft,'$.eventId') IS NOT json_extract(OLD.draft,'$.eventId')
      OR json_extract(NEW.draft,'$.shiftId') IS NOT json_extract(OLD.draft,'$.shiftId')
      OR json_extract(NEW.draft,'$.motorcycleCode') IS NOT json_extract(OLD.draft,'$.motorcycleCode')
      OR json_extract(NEW.draft,'$.currency') IS NOT json_extract(OLD.draft,'$.currency')
    BEGIN SELECT RAISE(ABORT,'fuel identity is immutable'); END`,
  `CREATE TRIGGER fuel_saved_immutable BEFORE UPDATE ON fuel_draft
    WHEN OLD.event_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'fuel observation is immutable'); END`,
  `CREATE TRIGGER fuel_retained BEFORE DELETE ON fuel_draft
    BEGIN SELECT RAISE(ABORT,'fuel evidence is retained'); END`,
] as const;
