/** Additive schema20: authored releases, including no-file drafts, retain their original owner. */
export const RELEASE_SCHEMA = [
  `CREATE TABLE release_draft(id TEXT PRIMARY KEY NOT NULL, owner_key TEXT NOT NULL,
    draft TEXT NOT NULL, event_id TEXT UNIQUE REFERENCES outbox_event(id),
    superseded_by TEXT REFERENCES release_draft(id) DEFERRABLE INITIALLY DEFERRED)`,
  `CREATE UNIQUE INDEX release_unfinished_device_task ON release_draft(owner_key,json_extract(draft,'$.shiftId'),
    json_extract(draft,'$.pins.task.id'),json_extract(draft,'$.pins.device.id'))
    WHERE event_id IS NULL AND superseded_by IS NULL`,
  `CREATE TRIGGER release_owner_activation BEFORE UPDATE ON attachment_context
    WHEN NEW.is_active=1 AND EXISTS(SELECT 1 FROM release_draft WHERE owner_key IS NOT NEW.owner_key)
    BEGIN SELECT RAISE(ABORT,'release owner conflict'); END`,
  `CREATE TRIGGER release_identity_immutable BEFORE UPDATE ON release_draft
    WHEN NEW.id IS NOT OLD.id OR NEW.owner_key IS NOT OLD.owner_key
      OR json_extract(NEW.draft,'$.eventId') IS NOT json_extract(OLD.draft,'$.eventId')
      OR json_extract(NEW.draft,'$.shiftId') IS NOT json_extract(OLD.draft,'$.shiftId')
      OR (NEW.event_id IS NULL AND json_extract(NEW.draft,'$.deviceTime') IS NOT json_extract(OLD.draft,'$.deviceTime'))
      OR json_extract(NEW.draft,'$.pins') IS NOT json_extract(OLD.draft,'$.pins')
      OR json_extract(NEW.draft,'$.trainingVersionId') IS NOT json_extract(OLD.draft,'$.trainingVersionId')
      OR json_extract(NEW.draft,'$.timezone') IS NOT json_extract(OLD.draft,'$.timezone')
      OR json_extract(NEW.draft,'$.catalogVersion') IS NOT json_extract(OLD.draft,'$.catalogVersion')
      OR json_extract(NEW.draft,'$.rulesVersion') IS NOT json_extract(OLD.draft,'$.rulesVersion')
    BEGIN SELECT RAISE(ABORT,'release identity is immutable'); END`,
  `CREATE TRIGGER release_saved_immutable BEFORE UPDATE ON release_draft
    WHEN OLD.event_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'release observation is immutable'); END`,
  `CREATE TRIGGER release_superseded_immutable BEFORE UPDATE ON release_draft
    WHEN OLD.superseded_by IS NOT NULL BEGIN SELECT RAISE(ABORT,'superseded release draft is immutable'); END`,
  `CREATE TRIGGER release_retained BEFORE DELETE ON release_draft
    BEGIN SELECT RAISE(ABORT,'release evidence is retained'); END`,
  `CREATE TRIGGER release_one_capture_per_task BEFORE UPDATE OF event_id ON release_draft
    WHEN NEW.event_id IS NOT NULL AND EXISTS(SELECT 1 FROM release_draft original WHERE original.id<>NEW.id
      AND original.owner_key=NEW.owner_key AND original.event_id IS NOT NULL
      AND json_extract(original.draft,'$.pins.task.id')=json_extract(NEW.draft,'$.pins.task.id'))
    BEGIN SELECT RAISE(ABORT,'release task is already captured'); END`,
] as const;
