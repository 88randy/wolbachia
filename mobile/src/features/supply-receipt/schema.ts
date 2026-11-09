/** Additive schema17; retained ownership begins before the first file is captured. */
export const SUPPLY_RECEIPT_SCHEMA = [
  `CREATE TABLE supply_receipt_draft(id TEXT PRIMARY KEY NOT NULL, owner_key TEXT NOT NULL,
    draft TEXT NOT NULL, event_id TEXT UNIQUE REFERENCES outbox_event(id))`,
  `CREATE UNIQUE INDEX supply_receipt_release ON supply_receipt_draft(owner_key,json_extract(draft,'$.releaseId'))`,
  `CREATE TRIGGER supply_receipt_owner_activation BEFORE UPDATE ON attachment_context
    WHEN NEW.is_active=1 AND EXISTS(SELECT 1 FROM supply_receipt_draft WHERE owner_key IS NOT NEW.owner_key)
    BEGIN SELECT RAISE(ABORT,'supply receipt owner conflict'); END`,
  `CREATE TRIGGER supply_receipt_identity_immutable BEFORE UPDATE OF id,owner_key ON supply_receipt_draft
    BEGIN SELECT RAISE(ABORT,'receipt ownership is immutable'); END`,
  `CREATE TRIGGER supply_receipt_saved_immutable BEFORE UPDATE ON supply_receipt_draft
    WHEN OLD.event_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'signed receipt is immutable'); END`,
  `CREATE TRIGGER supply_receipt_retained BEFORE DELETE ON supply_receipt_draft
    BEGIN SELECT RAISE(ABORT,'receipt evidence is retained'); END`,
] as const;
