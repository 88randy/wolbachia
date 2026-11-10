import type { Schemas } from "@wolbachia/api-client";
import type { EvidenceIdentity } from "../../src/attachments/evidence-session.ts";
import {
  CAPTURE_CONTEXT,
  captureBootstrap,
  captureHandle,
  CONTRACT_IDS,
  QUADRANT_REFERENCE,
} from "./lifecycle-contract-fixtures.ts";
import type { LegacyLifecycleDraft as LifecycleDraft } from "../../src/features/ovitrap-lifecycle/types.ts";
import { ASSIGNMENT, CATALOG, RULES } from "./m-08-fixtures.ts";

export const PROJECTION_NOW = new Date("2026-11-06T20:00:00Z");
export const PROJECTION_IDENTITY: EvidenceIdentity = {
  owner: captureHandle().owner,
  sessionId: captureHandle().sessionId,
};
export const PROJECTION_POINT = {
  id: CONTRACT_IDS.point,
  code: "OV-138",
  block_id: CONTRACT_IDS.otherQuadrant,
  quadrant_id: CONTRACT_IDS.quadrant,
  version: 1,
  is_retired: false,
  location: [-99, 19],
} satisfies Schemas["SamplingPointBundle"];
export const PROJECTION_TRAP = {
  id: "00000000-0000-4000-8000-000000000011",
  client_uuid: "00000000-0000-4000-8000-000000000011",
  sampling_point_id: CONTRACT_IDS.point,
  version: "physical-v1",
  placement_voided: false,
  is_retired: false,
};
/** Whole paired scope from the same producer snapshot; the display fixtures are not grants. */
export function projectionBundle() {
  const context = pairedContext();
  return {
    ...captureBootstrap(context),
    capture_context: context,
    next_change_at: null,
    map_manifest_ready: true,
    assignments: [],
    map_manifests: [],
    history: [],
    eligibility: [],
    supplies: [],
    sampling_points: [PROJECTION_POINT],
    ovitraps: [PROJECTION_TRAP],
    quadrants: [
      { ...QUADRANT_REFERENCE, is_closed: false, closure_id: null },
      {
        ...QUADRANT_REFERENCE,
        resource_type: "block",
        id: CONTRACT_IDS.otherQuadrant,
        code: "B-138",
      },
    ],
  };
}
function pairedContext(): Schemas["CaptureContext"] {
  return {
    ...CAPTURE_CONTEXT,
    grants: [
      {
        centers: { mode: "selected", ids: [CONTRACT_IDS.center] },
        quadrants: { mode: "selected", ids: [CONTRACT_IDS.quadrant] },
      },
    ],
  };
}
export function projectionChanges(patch: Record<string, unknown> = {}) {
  return {
    cursor: "opaque-next",
    has_more: false,
    assignments: [],
    map_manifests: [],
    history: [],
    quadrants: [],
    ovitraps: [],
    sampling_points: [],
    capture_context: projectionBundle().capture_context,
    ...patch,
  };
}
export function quadrantChange(data: unknown, sequence: number) {
  return {
    action: "upsert",
    resource_type: "quadrant",
    resource_id: CONTRACT_IDS.quadrant,
    resource_version: `opaque-epoch-publication-${String(sequence)}`,
    sequence,
    data,
  };
}
export function projectionDraft(eventId = CONTRACT_IDS.source): LifecycleDraft {
  const point = { id: PROJECTION_POINT.id, code: PROJECTION_POINT.code, lat: 19, lng: -99 };
  return {
    ...DRAFT_FIELDS,
    eventId,
    point,
    assignment: { ...ASSIGNMENT, points: [point], ovitraps: [{ id: PROJECTION_TRAP.id, point }] },
  };
}
const REASON = {
  code: "other",
  is_other: true,
  label_es: "Otro",
  label_en: "Other",
  requires_photo: true,
};
const DRAFT_FIELDS: Omit<LifecycleDraft, "eventId" | "point" | "assignment"> = {
  kind: "relocate",
  ovitrapId: PROJECTION_TRAP.id,
  deviceTime: PROJECTION_NOW.toISOString(),
  shiftId: CONTRACT_IDS.history,
  replacementId: null,
  catalog: {
    version: CATALOG.version,
    replace: [REASON],
    relocate: [REASON],
    remove: [REASON],
    voidReasons: [REASON],
  },
  rules: { ...RULES, closedHouseWeeks: 2, incidents: 3 },
  gps: { lat: 19, lng: -99, accuracy_m: 5 },
  proposedLocation: [-99, 19],
  manualCapture: false,
  reasonCode: "other",
  otherText: "Synthetic capture reason",
  recovery: null,
  evidence: [{ id: CONTRACT_IDS.device, fileRef: "private-synthetic-original" }],
  discardedEvidence: [],
  reviewAcknowledged: true,
};
