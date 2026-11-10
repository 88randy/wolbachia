import type { ReleaseDraft, ReleasePins } from "../../src/features/releases/types.ts";
import { ownerKey } from "../../src/attachments/types.ts";
import { OWNER } from "./attachment-fixtures.ts";
import { makeEnvelope } from "./factories.ts";

export const RELEASE_NOW = new Date("2026-11-09T16:00:00Z");
export const RELEASE_IDS = {
  event: "10000000-0000-4000-8000-000000000001",
  shift: "10000000-0000-4000-8000-000000000002",
  permit: "10000000-0000-4000-8000-000000000003",
  permitVersion: "10000000-0000-4000-8000-000000000004",
  type: "10000000-0000-4000-8000-000000000005",
  device: "10000000-0000-4000-8000-000000000006",
  lot: "10000000-0000-4000-8000-000000000007",
  lotVersion: "10000000-0000-4000-8000-000000000008",
  task: "10000000-0000-4000-8000-000000000009",
  point: "10000000-0000-4000-8000-000000000010",
  center: "10000000-0000-4000-8000-000000000011",
  quadrant: "10000000-0000-4000-8000-000000000012",
  receipt: "10000000-0000-4000-8000-000000000013",
  source: "10000000-0000-4000-8000-000000000014",
  assignment: "10000000-0000-4000-8000-000000000015",
  unit: "10000000-0000-4000-8000-000000000016",
  policy: "10000000-0000-4000-8000-000000000017",
  eligibility: "10000000-0000-4000-8000-000000000018",
  requirement: "10000000-0000-4000-8000-000000000019",
  training: "10000000-0000-4000-8000-000000000020",
  assessment: "10000000-0000-4000-8000-000000000021",
  certification: "10000000-0000-4000-8000-000000000022",
};
const VALID_FROM = "2026-11-01T00:00:00Z";
const VALID_UNTIL = "2026-12-01T00:00:00Z";

function releaseCustodyFixture(): ReleasePins["custody"] {
  return {
    receipt_line_id: RELEASE_IDS.receipt,
    receipt_source_event_id: RELEASE_IDS.source,
    assignment_id: RELEASE_IDS.assignment,
    assignment_date: "2026-11-09",
    shift_id: RELEASE_IDS.shift,
    unit_version_id: RELEASE_IDS.unit,
    piece_id: null,
    available_quantity: "10.000000",
    accounted_release_event_ids: [],
    received_at: "2026-11-09T15:00:00Z",
    source_lot_version_id: RELEASE_IDS.lotVersion,
    current_lot_version_id: RELEASE_IDS.lotVersion,
    source_expires_at: VALID_UNTIL,
    current_expires_at: VALID_UNTIL,
    transit_policy_id: RELEASE_IDS.policy,
    transit_mode: "manual_evidence_review",
    proof_roles: ["photo"],
    requires_evidence: true,
    blocked_by: [],
  };
}
function releaseDeviceFixture(custody: ReleasePins["custody"]): ReleasePins["device"] {
  return {
    id: RELEASE_IDS.device,
    code: "RD-139",
    status: "active",
    revision: 1,
    created_at: VALID_FROM,
    source_lot_id: RELEASE_IDS.lot,
    source_lot_version_id: RELEASE_IDS.lotVersion,
    custody: [custody],
  };
}
function releaseTaskFixture(): ReleasePins["task"] {
  return {
    id: RELEASE_IDS.task,
    point_id: RELEASE_IDS.point,
    permit_id: RELEASE_IDS.permit,
    permit_version_id: RELEASE_IDS.permitVersion,
    courier_id: OWNER.userId,
    due_date: "2026-11-09",
    owner_revision: 1,
    is_completed: false,
    created_at: VALID_FROM,
    binding_created_at: VALID_FROM,
    owner_created_at: VALID_FROM,
  };
}
function releaseGeometry() {
  return {
    type: "Polygon",
    coordinates: [
      [
        [-100, 18],
        [-98, 18],
        [-98, 20],
        [-100, 20],
        [-100, 18],
      ],
    ],
  };
}
function releasePermitFixture(input: Pick<ReleasePins, "device" | "task">): ReleasePins["permit"] {
  return {
    id: RELEASE_IDS.permit,
    code: "PERMIT-139",
    version: "permit-v1",
    permit_version_id: RELEASE_IDS.permitVersion,
    permit_type_id: RELEASE_IDS.type,
    revision: 1,
    center_id: RELEASE_IDS.center,
    quadrant_id: RELEASE_IDS.quadrant,
    geometry: releaseGeometry(),
    valid_from: VALID_FROM,
    valid_to: VALID_UNTIL,
    requirements: { max_gps_accuracy_m: 8 },
    blocked_by: [],
    capture: {
      as_of: VALID_FROM,
      version: "capture-v1",
      devices: [input.device],
      tasks: [input.task],
    },
  };
}
function releaseEligibilityFixture(): ReleasePins["eligibility"] {
  return {
    id: RELEASE_IDS.eligibility,
    subject_id: OWNER.userId,
    organization_id: OWNER.organizationId,
    action: "release.record",
    center_id: RELEASE_IDS.center,
    quadrant_id: RELEASE_IDS.quadrant,
    training_eligible: true,
    requirement_version_id: RELEASE_IDS.requirement,
    certification_ids: [RELEASE_IDS.certification],
    training_version_ids: [RELEASE_IDS.training],
    revocation_ids: [],
    valid_from: VALID_FROM,
    valid_until: VALID_UNTIL,
    next_change_at: null,
    blockers: [],
    assessment_receipt: RELEASE_IDS.assessment,
    version: "training-v1",
  };
}
export function releasePins(): ReleasePins {
  const custody = releaseCustodyFixture(),
    device = releaseDeviceFixture(custody),
    task = releaseTaskFixture();
  return {
    permit: releasePermitFixture({ device, task }),
    device,
    task,
    custody,
    eligibility: releaseEligibilityFixture(),
    captureVersion: "capture-v1",
  };
}
export function releaseDraft(overrides: Partial<ReleaseDraft> = {}): ReleaseDraft {
  return {
    eventId: RELEASE_IDS.event,
    ownerKey: ownerKey(OWNER),
    shiftId: RELEASE_IDS.shift,
    timezone: "America/Mexico_City",
    deviceTime: RELEASE_NOW.toISOString(),
    catalogVersion: "catalog-v1",
    rulesVersion: "rules-v1",
    trainingVersionId: RELEASE_IDS.training,
    manualCapture: false,
    pins: releasePins(),
    quantity: "2.000000",
    gps: { lat: 19, lng: -99, accuracy_m: 4 },
    evidence: [],
    ...overrides,
  };
}
export function releaseEnvelope(draft = releaseDraft()) {
  return makeEnvelope({
    id: draft.eventId,
    type: "release.record",
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: draft.gps,
    rules_version: draft.rulesVersion,
    catalog_version: draft.catalogVersion,
    manual_capture: draft.manualCapture,
    payload: {
      permit_id: draft.pins.permit.id,
      release_device_id: draft.pins.device.id,
      lot_id: draft.pins.device.source_lot_id,
      quantity: draft.quantity,
      schedule_task_id: draft.pins.task.id,
      training_version: draft.trainingVersionId,
      evidence_ids: draft.evidence.map(({ id }) => id),
    },
  });
}
