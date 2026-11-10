import assert from "node:assert/strict";
import { test } from "node:test";
import { qualificationState, certificationState } from "../src/features/training/domain.ts";
import { readEligibility } from "../src/features/training/contract.ts";
import { CONTRACT_IDS, captureHandle } from "./support/lifecycle-contract-fixtures.ts";
import { trainingEligibility } from "./training-fixtures.ts";

void test("P30 qualification expires at the exact exclusive boundary and never treats unknown data as a grant", () => {
  const row = readEligibility(trainingEligibility());
  assert.equal(qualificationState(row, new Date("2026-11-09T23:59:59Z")), "eligible");
  assert.equal(qualificationState(row, new Date(row.valid_until ?? "")), "expired");
  assert.equal(
    qualificationState({ ...row, assessment_receipt: null }, new Date(row.valid_from ?? "")),
    "unavailable",
  );
  assert.equal(
    qualificationState({ ...row, training_eligible: false }, new Date(row.valid_from ?? "")),
    "blocked",
  );
  assert.equal(
    qualificationState({ ...row, next_change_at: row.valid_from }, new Date(row.valid_from ?? "")),
    "unavailable",
  );
  assert.equal(qualificationState(row, new Date("2026-10-31T23:59:59Z")), "unavailable");
  assert.throws(() => readEligibility({ ...row, training_eligible: "true" }));
});

void test("P30 certificate withdrawal and future validity remain distinct from expiration", () => {
  const row = {
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
  assert.equal(certificationState(row, new Date("2026-11-09T00:00:00Z")), "valid");
  assert.equal(certificationState(row, new Date(row.valid_to)), "expired");
  assert.equal(certificationState(row, new Date("2026-10-01T00:00:00Z")), "future");
  assert.equal(
    certificationState({ ...row, revoked_from: row.valid_from }, new Date(row.valid_from)),
    "revoked",
  );
});
