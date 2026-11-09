import type { Schemas } from "@wolbachia/api-client";
export const PROPOSAL_ID = "10000000-0000-4000-8000-000000000160";
export const POINT_ID = "20000000-0000-4000-8000-000000000160";
export const INSTANT = "2026-11-09T16:00:00Z";
const ORIGINAL_PROPOSAL: Schemas["Relocation"] = {
  id: PROPOSAL_ID,
  code: PROPOSAL_ID,
  point: POINT_ID,
  point_code: "P-160",
  ovitrap: "30000000-0000-4000-8000-000000000160",
  point_version: "40000000-0000-4000-8000-000000000160",
  old_location: [-99.1, 19.4],
  new_location: [-99.11, 19.41],
  reason_code: "closed",
  reason_label: "Closed house",
  other_text: "",
  evidence_ids: ["50000000-0000-4000-8000-000000000160"],
  evaluated_rules: { spacing: "advisory_only" },
  rule_version_ids: [],
  event_id: "60000000-0000-4000-8000-000000000160",
  device_time: INSTANT,
  server_received_at: INSTANT,
  rules_version: "rules-160",
  catalog_version: "catalog-160",
  manual_capture: false,
  gps: null,
  status: "pending",
  voided_at: null,
  void_reason: "",
  void_reason_code: "",
  created_by: POINT_ID,
  created_at: INSTANT,
};
export function proposal(overrides: Partial<Schemas["Relocation"]> = {}): Schemas["Relocation"] {
  return { ...ORIGINAL_PROPOSAL, ...overrides };
}
export function relocationReceipt(
  decision: "approved" | "rejected",
): Schemas["RelocationDecisionResult"] {
  return {
    decision: {
      id: POINT_ID,
      proposal: PROPOSAL_ID,
      event: proposal().event_id,
      decision,
      reason: "Reviewed original site evidence",
      revision: 1,
      decided_at: INSTANT,
      published_point_version: null,
      created_by: POINT_ID,
      created_at: INSTANT,
    },
    point_version: null,
    next_day_task:
      decision === "rejected" ? { id: POINT_ID, code: "ND-160", due_date: "2026-11-10" } : null,
    warnings: [],
  };
}
