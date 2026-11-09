import type { Schemas } from "@wolbachia/api-client";
import type { CaptureTransportHandle } from "../../src/features/ovitrap-lifecycle/capture-context-contract.ts";

// Transcribed from the canonical history producer payloads, not another API.
export const CONTRACT_IDS = {
  history: "00000000-0000-4000-8000-000000000001",
  source: "00000000-0000-4000-8000-000000000002",
  point: "00000000-0000-4000-8000-000000000003",
  center: "00000000-0000-4000-8000-000000000004",
  quadrant: "00000000-0000-4000-8000-000000000005",
  otherCenter: "00000000-0000-4000-8000-000000000006",
  otherQuadrant: "00000000-0000-4000-8000-000000000007",
  actor: "00000000-0000-4000-8000-000000000008",
  organization: "00000000-0000-4000-8000-000000000009",
  device: "00000000-0000-4000-8000-000000000010",
};
export const SCOPE_REVISION = "a".repeat(64);
export const REVIEW_HISTORY = {
  id: CONTRACT_IDS.history,
  kind: "review_decision",
  review_item_id: CONTRACT_IDS.point,
  source_event_id: CONTRACT_IDS.source,
  shift_id: null,
  decision_kind: "accept",
  revision: 2,
  is_terminal: true,
  decision_state: "accepted",
  reason: "Original capture reviewed",
  decided_by: CONTRACT_IDS.actor,
  decided_at: "2026-11-06T20:00:00Z",
  subjects: [{ center_id: CONTRACT_IDS.center, quadrant_id: CONTRACT_IDS.quadrant }],
  source_status: "in_review",
  source_code: "clock_skew",
  effect_state: "applied_review",
  incident_id: null,
  declared_void_target_uuid: null,
  approval_current: null,
} satisfies Schemas["ReviewHistoryEntry"];
export const SHIFT_HISTORY = {
  ...REVIEW_HISTORY,
  kind: "shift_validation",
  review_item_id: null,
  shift_id: CONTRACT_IDS.point,
  decision_kind: "approve",
  is_terminal: null,
  decision_state: "approved",
  effect_state: "approved",
  approval_current: false,
} satisfies Schemas["ReviewHistoryEntry"];
export const RELOCATION_HISTORY = {
  id: CONTRACT_IDS.history,
  kind: "relocation_proposal",
  proposal_event_id: CONTRACT_IDS.source,
  point_id: CONTRACT_IDS.point,
  point_code: "OV-138",
  status: "pending",
  proposed_location: [-99.99, 20.005],
  decision: null,
  next_day_task: null,
  source_voided_at: null,
  subjects: [{ center_id: CONTRACT_IDS.center, quadrant_id: CONTRACT_IDS.quadrant }],
} satisfies Schemas["RelocationHistoryEntry"];
export const TRANSFER_HISTORY = {
  id: CONTRACT_IDS.history,
  kind: "transfer_custody",
  transfer_id: CONTRACT_IDS.point,
  transfer_code: "SYNTHETIC-TRANSFER",
  phase: "receive",
  revision: 3,
  manifest_hash: "a".repeat(64),
  source_event_id: CONTRACT_IDS.source,
  source_status: "in_review",
  source_code: "causal_parent_pending",
  voided_at: null,
  subjects: [
    { center_id: CONTRACT_IDS.center, quadrant_id: null },
    { center_id: CONTRACT_IDS.otherCenter, quadrant_id: CONTRACT_IDS.otherQuadrant },
  ],
} satisfies Schemas["TransferHistoryEntry"];
export const LAB_RECEIPT = {
  id: CONTRACT_IDS.history,
  kind: "lab_receipt",
  reading_id: CONTRACT_IDS.point,
  bag_id: null,
  source_event_id: CONTRACT_IDS.source,
  recorded_at: "2026-11-07T09:00:00Z",
  author_id: CONTRACT_IDS.actor,
  source_device_time: "2026-11-08T09:00:00+00:00",
  source_server_received_at: "2026-11-06T20:00:00Z",
  subjects: [{ center_id: CONTRACT_IDS.center, quadrant_id: CONTRACT_IDS.quadrant }],
  count_id: null,
  rejection_id: null,
  value: null,
  viability_percent: null,
  qa_state: "not_requested",
  voided: false,
  incident_id: null,
  configuration_pending: false,
  method_version_id: null,
  reason: null,
} satisfies Schemas["LabHistoryEntry"];
export const LAB_DISCREPANCY = {
  ...LAB_RECEIPT,
  kind: "lab_discrepancy",
  bag_id: CONTRACT_IDS.point,
  configuration_pending: true,
  reason: "",
} satisfies Schemas["LabHistoryEntry"];
export const LAB_COUNT = {
  ...LAB_RECEIPT,
  kind: "lab_count",
  bag_id: CONTRACT_IDS.point,
  count_id: CONTRACT_IDS.history,
  value: 0,
  viability_percent: "0.000000",
  method_version_id: CONTRACT_IDS.actor,
  qa_state: "awaiting_independent_qa",
} satisfies Schemas["LabHistoryEntry"];
export const LAB_REJECTION = {
  ...LAB_RECEIPT,
  kind: "lab_rejection",
  bag_id: CONTRACT_IDS.point,
  rejection_id: CONTRACT_IDS.history,
  method_version_id: CONTRACT_IDS.actor,
  reason: "",
  voided: true,
} satisfies Schemas["LabHistoryEntry"];
export const LAB_VOID = {
  ...LAB_RECEIPT,
  kind: "lab_void",
  bag_id: CONTRACT_IDS.point,
  count_id: CONTRACT_IDS.point,
  reason: "Retained result correction",
  voided: true,
} satisfies Schemas["LabHistoryEntry"];
export const LAB_HISTORY = [
  LAB_RECEIPT,
  LAB_DISCREPANCY,
  LAB_COUNT,
  LAB_REJECTION,
  LAB_VOID,
] satisfies Schemas["LabHistoryEntry"][];
export const COMMUNITY_HISTORY = {
  id: CONTRACT_IDS.history,
  kind: "community_activity",
  activity_id: CONTRACT_IDS.history,
  event_id: CONTRACT_IDS.point,
  command_id: CONTRACT_IDS.history,
  code: "ACT-138",
  revision: 1,
  type_id: CONTRACT_IDS.actor,
  type_snapshot: {
    code: "aggregate",
    label_es: "Actividad sintética",
    label_en: "",
    is_other: false,
    requires_photo: false,
  },
  zone_id: CONTRACT_IDS.point,
  zone_version_id: CONTRACT_IDS.source,
  activity_date: "2026-11-06",
  attendance: 0,
  is_voided: false,
  source_event_id: CONTRACT_IDS.history,
  source_device_time: "2026-11-06T19:00:00Z",
  source_server_received_at: "2026-11-06T20:00:00Z",
  subjects: [{ center_id: CONTRACT_IDS.center, quadrant_id: CONTRACT_IDS.quadrant }],
} satisfies Schemas["CommunityHistoryEntry"];
export const SUPPLY_HISTORY = (
  [
    "plan",
    "release",
    "cancel",
    "receipt",
    "reconcile",
    "return",
    "justify",
    "bag_disposal",
  ] as const
).map((source_kind): Schemas["SupplyHistoryEntry"] => ({
  id: CONTRACT_IDS.history,
  kind: `supply_${source_kind}`,
  source_kind,
  assignment_id: source_kind === "bag_disposal" ? null : CONTRACT_IDS.point,
  bag_id: source_kind === "bag_disposal" ? CONTRACT_IDS.point : null,
  actor_id: CONTRACT_IDS.actor,
  at: "2026-11-06T20:00:00Z",
  subjects: [{ center_id: CONTRACT_IDS.center, quadrant_id: CONTRACT_IDS.quadrant }],
  source_event_id: ["receipt", "reconcile", "bag_disposal"].includes(source_kind)
    ? CONTRACT_IDS.source
    : null,
  source_status: ["receipt", "reconcile", "bag_disposal"].includes(source_kind) ? "accepted" : null,
  source_code: ["receipt", "reconcile", "bag_disposal"].includes(source_kind) ? "accepted" : null,
  voided_at: null,
}));
export const QUADRANT_REFERENCE = {
  resource_type: "quadrant",
  id: CONTRACT_IDS.quadrant,
  code: "Q-138",
  center_id: CONTRACT_IDS.center,
  quadrant_id: CONTRACT_IDS.quadrant,
  revision: 3,
} satisfies Schemas["QuadrantReference"];
export const CAPTURE_CONTEXT = {
  schema_version: 1,
  permission: "field_event.sync",
  user_id: CONTRACT_IDS.actor,
  organization_id: CONTRACT_IDS.organization,
  scope_revision: SCOPE_REVISION,
  grants: [
    {
      centers: { mode: "selected", ids: [CONTRACT_IDS.center] },
      quadrants: { mode: "selected", ids: [CONTRACT_IDS.otherQuadrant] },
    },
    {
      centers: { mode: "selected", ids: [CONTRACT_IDS.otherCenter] },
      quadrants: { mode: "selected", ids: [CONTRACT_IDS.quadrant] },
    },
  ],
} satisfies Schemas["CaptureContext"];
/** Explicit proven-transport fixture; no DTO field constructs this local handle. */
export function captureHandle(): CaptureTransportHandle {
  return {
    owner: {
      issuer: "https://fixture.invalid/api/v1/",
      organizationId: CONTRACT_IDS.organization,
      userId: CONTRACT_IDS.actor,
      deviceId: CONTRACT_IDS.device,
    },
    sessionId: "retained-test-session",
    revision: 7,
    scopeRevision: SCOPE_REVISION,
    isCurrent: () => true,
  };
}
export function captureBootstrap(context: unknown = CAPTURE_CONTEXT) {
  return {
    bundle_version: "opaque-bundle",
    schema_version: "opaque-root-schema",
    scope_revision: SCOPE_REVISION,
    cursor: "opaque-signed-cursor",
    capture_context: context,
  };
}
export function historyChange(data: unknown = REVIEW_HISTORY) {
  const entry = data as { id: string; kind: string };
  return {
    sequence: 8,
    action: "upsert",
    resource_type: `history.${entry.kind}`,
    resource_id: entry.id,
    resource_version: "opaque:publication-v2",
    data,
  };
}
