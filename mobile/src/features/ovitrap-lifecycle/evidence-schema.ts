/** Schema16: unknown legacy references cannot acquire a fresh owner. Existing owned files stay immutable. */
export const LIFECYCLE_EVIDENCE_SCHEMA: readonly string[] = [
  "CREATE INDEX lifecycle_evidence_uuid ON lifecycle_evidence(lower(evidence_id))",
  `CREATE TRIGGER lifecycle_unproven_evidence_reservation BEFORE INSERT ON attachment_file
    WHEN NOT EXISTS(SELECT 1 FROM attachment_file WHERE id=NEW.id)
      AND EXISTS(SELECT 1 FROM lifecycle_evidence WHERE lower(evidence_id)=lower(NEW.id))
    BEGIN SELECT RAISE(ABORT,'unproven lifecycle evidence cannot be adopted'); END`,
];
