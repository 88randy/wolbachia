import type { Eligibility, Certification, EvaluationFeedback } from "./types.ts";
import {
  readRecord,
  readUuid,
  readBoolean,
  nullable,
  readInstant,
  readNonempty,
  readString,
  requireFields,
  readPositiveInteger,
  choice,
} from "../ovitrap-lifecycle/contract-readers.ts";

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Invalid training list.");
  return (value as unknown[]).map(readString);
}
function uuids(value: unknown): string[] {
  return strings(value).map(readUuid);
}
export function readEligibility(value: unknown): Eligibility {
  const row = readRecord(value);
  requireFields(row, {
    id: readUuid,
    subject_id: readUuid,
    organization_id: readUuid,
    action: readNonempty,
    center_id: readUuid,
    quadrant_id: nullable(readUuid),
    training_eligible: readBoolean,
    requirement_version_id: nullable(readUuid),
    certification_ids: uuids,
    training_version_ids: uuids,
    revocation_ids: uuids,
    valid_from: nullable(readInstant),
    valid_until: nullable(readInstant),
    next_change_at: nullable(readInstant),
    blockers: strings,
    assessment_receipt: nullable(readUuid),
    version: readNonempty,
  });
  return { ...row } as Eligibility;
}
export function readCertification(value: unknown): Certification {
  const row = readRecord(value);
  requireFields(row, {
    id: readUuid,
    subject_id: readUuid,
    training_version_id: readUuid,
    center_id: readUuid,
    quadrant_id: nullable(readUuid),
    valid_from: readInstant,
    valid_to: readInstant,
    created_at: readInstant,
    revision: readPositiveInteger,
    revoked_from: nullable(readInstant),
  });
  return {
    id: readUuid(row.id),
    subject_id: readUuid(row.subject_id),
    training_version_id: readUuid(row.training_version_id),
    center_id: readUuid(row.center_id),
    quadrant_id: nullable(readUuid)(row.quadrant_id),
    valid_from: readInstant(row.valid_from),
    valid_to: readInstant(row.valid_to),
    created_at: readInstant(row.created_at),
    revision: readPositiveInteger(row.revision),
    revoked_from: nullable(readInstant)(row.revoked_from),
  };
}
function attempt(value: unknown): EvaluationFeedback["current"] {
  if (value === null) return null;
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    revision: readPositiveInteger(row.revision),
    observed_at: readInstant(row.observed_at),
    outcome: choice(["incomplete", "pass", "low", "critical_failure"])(row.outcome),
    created_by: readUuid(row.created_by),
    predecessor_id: nullable(readUuid)(row.predecessor_id),
    ...(typeof row.reason === "string" ? { reason: row.reason } : {}),
  };
}
function voidFact(value: unknown): EvaluationFeedback["void"] {
  if (value === null) return null;
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    evaluation_id: readUuid(row.evaluation_id),
    attempt_id: readUuid(row.attempt_id),
    revision: readPositiveInteger(row.revision),
    reason_code: readNonempty(row.reason_code),
    reason: readString(row.reason),
    created_at: readInstant(row.created_at),
    created_by: readUuid(row.created_by),
  };
}
/** Deliberately omit raw section scores, critical responses and all issuer/evidence material. */
export function readEvaluation(value: unknown): EvaluationFeedback {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    subject_id: readUuid(row.subject_id),
    center_id: readUuid(row.center_id),
    quadrant_id: nullable(readUuid)(row.quadrant_id),
    rubric_version_id: readUuid(row.rubric_version_id),
    revision: readPositiveInteger(row.revision),
    is_voided: readBoolean(row.is_voided),
    current: attempt(row.current),
    void: voidFact(row.void),
  };
}
