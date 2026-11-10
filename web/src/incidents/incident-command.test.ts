import { expect, test } from "vitest";
import type { Incident } from "./incidents-query";
import { canCloseIncident, verifiedIncidentEvidence } from "./incident-command";
function policy(minimum: number): Incident {
  return {
    action_permissions: { close: true },
    action_prerequisites: { is_open: true, close_evidence_min: minimum, can_upload_evidence: true },
  } as Incident;
}
test("duplicate, redacted and pending evidence cannot satisfy closure requirements", () => {
  const proof = {
    id: "verified",
    is_readable: true,
    is_verified: true,
    verified_at: "2026-11-01T12:00:00Z",
    content_type: "image/png",
    size_bytes: 100,
  };
  const record = {
    ...policy(2),
    evidence: [
      proof,
      proof,
      { ...proof, id: "private", is_readable: false },
      { ...proof, id: "pending", is_verified: false },
    ],
  };
  const ids = verifiedIncidentEvidence(record);
  expect(ids).toEqual(["verified"]);
  expect(
    canCloseIncident(record, ids, {
      reason: "Resolved safely",
      limits: { minLength: 10, maxLength: 1000 },
    }),
  ).toBe(false);
  expect(
    canCloseIncident(record, verifiedIncidentEvidence(record, ["new", "new"]), {
      reason: "Resolved safely",
      limits: { minLength: 10, maxLength: 1000 },
    }),
  ).toBe(true);
});
test.each(["", "   ", "short", "a".repeat(1001)])(
  "rejects an absent or oversized closing reason",
  (reason) => {
    expect(
      canCloseIncident(policy(1), ["proof"], {
        reason,
        limits: { minLength: 10, maxLength: 1000 },
      }),
    ).toBe(false);
  },
);
test("unknown prerequisites and a closed incident fail closed", () => {
  expect(
    canCloseIncident({ ...policy(1), action_prerequisites: null }, ["proof"], {
      reason: "Resolved safely",
      limits: { minLength: 10, maxLength: 1000 },
    }),
  ).toBe(false);
  const record = policy(1);
  expect(
    canCloseIncident(
      {
        ...record,
        action_prerequisites: {
          is_open: false,
          has_void_dependents: false,
          is_severity_protected: false,
          close_evidence_min: 1,
          can_upload_evidence: true,
        },
      },
      ["proof"],
      { reason: "Resolved safely", limits: { minLength: 10, maxLength: 1000 } },
    ),
  ).toBe(false);
});

test("existing verified evidence still requires current upload permission", () => {
  const record = policy(1);
  expect(
    canCloseIncident(
      {
        ...record,
        action_prerequisites: {
          is_open: true,
          has_void_dependents: false,
          is_severity_protected: false,
          close_evidence_min: 1,
          can_upload_evidence: false,
        },
      },
      ["proof"],
      { reason: "Resolved safely", limits: { minLength: 10, maxLength: 1000 } },
    ),
  ).toBe(false);
});
