import type { Schemas } from "@wolbachia/api-client";
import { CONTRACT_IDS, captureHandle } from "./support/lifecycle-contract-fixtures.ts";

export function trainingEligibility(): Schemas["EligibilityBundle"] {
  const owner = captureHandle().owner;
  return {
    id: CONTRACT_IDS.history,
    subject_id: owner.userId,
    organization_id: owner.organizationId,
    action: "ovitrap.check",
    center_id: CONTRACT_IDS.center,
    quadrant_id: CONTRACT_IDS.quadrant,
    training_eligible: true,
    requirement_version_id: CONTRACT_IDS.source,
    certification_ids: [CONTRACT_IDS.history],
    training_version_ids: [CONTRACT_IDS.source],
    revocation_ids: [],
    valid_from: "2026-11-01T00:00:00Z",
    valid_until: "2026-11-10T00:00:00Z",
    next_change_at: "2026-11-10T00:00:00Z",
    blockers: [],
    assessment_receipt: CONTRACT_IDS.history,
    version: "semantic-version",
  };
}
export function trainingCertificate(): Schemas["CertificationSummary"] {
  return {
    id: CONTRACT_IDS.history,
    subject_id: captureHandle().owner.userId,
    center_id: CONTRACT_IDS.center,
    quadrant_id: CONTRACT_IDS.quadrant,
    training_version_id: CONTRACT_IDS.source,
    revision: 1,
    valid_from: "2026-11-01T00:00:00Z",
    valid_to: "2026-11-10T00:00:00Z",
    revoked_from: null,
    created_at: "2026-11-01T00:00:00Z",
  };
}
export function trainingEvaluation(): Schemas["EvaluationRead"] {
  return {
    id: CONTRACT_IDS.source,
    subject_id: captureHandle().owner.userId,
    center_id: CONTRACT_IDS.center,
    quadrant_id: CONTRACT_IDS.quadrant,
    rubric_version_id: CONTRACT_IDS.source,
    revision: 2,
    created_at: "2026-11-01T00:00:00Z",
    is_voided: true,
    current: evaluationAttempt(),
    void: {
      id: CONTRACT_IDS.actor,
      evaluation_id: CONTRACT_IDS.source,
      attempt_id: CONTRACT_IDS.history,
      revision: 3,
      reason_code: "other",
      reason: "Original observation corrected",
      created_at: "2026-11-04T00:00:00Z",
      created_by: CONTRACT_IDS.actor,
    },
  };
}
function evaluationAttempt(): Schemas["EvaluationAttemptRead"] {
  return {
    id: CONTRACT_IDS.history,
    evaluation_id: CONTRACT_IDS.source,
    predecessor_id: CONTRACT_IDS.actor,
    revision: 2,
    observed_at: "2026-11-03T00:00:00Z",
    section_scores: { private: "80" },
    critical_responses: { private: false },
    score: "80",
    outcome: "low",
    created_by: CONTRACT_IDS.actor,
    created_at: "2026-11-03T00:00:00Z",
    completion_sequence: 1,
    reason: "Retained improvement feedback",
  };
}
