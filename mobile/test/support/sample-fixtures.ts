import { ownerKey } from "../../src/attachments/types.ts";
import type {
  SampleDraft,
  SampleMethod,
  SampleOrigin,
  SampleSnapshot,
  SampleSource,
} from "../../src/features/samples/types.ts";
import type { SampleProjectionSource } from "../../src/features/samples/projection.ts";
import { CONTRACT_IDS, captureHandle } from "./lifecycle-contract-fixtures.ts";
import { PROJECTION_IDENTITY, projectionBundle } from "./lifecycle-projection-fixtures.ts";

export const SAMPLE_NOW = new Date("2026-11-10T16:00:00Z");
export const sampleId = (number: number) =>
  `20000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const SAMPLE_ORIGIN: SampleOrigin = {
  code: "lot",
  label: "Lote",
  label_es: "Lote",
  label_en: "Lot",
  is_other: false,
  requires_photo: true,
};
const BEFORE = "2026-11-01T00:00:00Z";
export function sampleMethod(): SampleMethod {
  return {
    id: sampleId(1),
    method_id: sampleId(2),
    label: "Synthetic verified method",
    revision: 1,
    created_at: BEFORE,
    effective_from: BEFORE,
    content_hash: "a".repeat(64),
    supports_wolbachia: true,
    verification: {
      id: sampleId(3),
      revision: 1,
      decision: "verify",
      content_hash: "a".repeat(64),
      created_at: BEFORE,
    },
  };
}
export function sampleSource(): SampleSource {
  return {
    kind: "lot",
    id: sampleId(4),
    label: "LOT-139",
    center_id: CONTRACT_IDS.center,
    quadrant_id: CONTRACT_IDS.quadrant,
    author_id: null,
    event_id: null,
    device_time: null,
    created_at: BEFORE,
    effective: true,
    lot_version_id: sampleId(5),
    lot_version_revision: 1,
    lot_version_created_at: BEFORE,
  };
}
export function sampleSnapshot(patch: Partial<SampleSnapshot> = {}): SampleSnapshot {
  return {
    schema_version: 1,
    organization_id: PROJECTION_IDENTITY.owner.organizationId,
    user_id: PROJECTION_IDENTITY.owner.userId,
    version: "sample-capture-v1",
    as_of: "2026-11-10T15:00:00Z",
    valid_until: null,
    methods: [sampleMethod()],
    sources: [sampleSource()],
    receipts: [],
    ...patch,
  };
}
export function sampleBundle() {
  return { ...projectionBundle(), permits: [], sample_capture: sampleSnapshot() };
}
export function sampleDraft(patch: Partial<SampleDraft> = {}): SampleDraft {
  const source = sampleSource();
  return {
    sampleId: sampleId(6),
    eventId: sampleId(7),
    ownerKey: ownerKey(PROJECTION_IDENTITY.owner),
    shiftId: sampleId(8),
    startedAt: SAMPLE_NOW.toISOString(),
    deviceTime: SAMPLE_NOW.toISOString(),
    timezone: "America/Mexico_City",
    manualCapture: false,
    sourceRef: { kind: source.kind, id: source.id },
    source,
    captureVersion: "sample-capture-v1",
    catalogVersion: "catalog-sample-v1",
    rulesVersion: "rules-sample-v1",
    code: "SAMPLE-139",
    otherText: "",
    originCode: SAMPLE_ORIGIN.code,
    methodVersion: sampleMethod().id,
    origin: SAMPLE_ORIGIN,
    method: sampleMethod(),
    gps: { lat: 19, lng: -99, accuracy_m: 100 },
    evidence: [{ id: sampleId(9), fileRef: "owned-synthetic" }],
    ...patch,
  };
}
export function sampleProjection(
  patch: Partial<SampleProjectionSource> = {},
): SampleProjectionSource {
  return {
    snapshot: sampleSnapshot(),
    handle: captureHandle(),
    guard: { sql: "SELECT 1" },
    catalogVersion: "catalog-sample-v1",
    rulesVersion: "rules-sample-v1",
    origins: [SAMPLE_ORIGIN],
    canUpload: true,
    ...patch,
  };
}
export function sampleProfile() {
  return {
    issuer: PROJECTION_IDENTITY.owner.issuer,
    sessionId: PROJECTION_IDENTITY.sessionId,
    userId: PROJECTION_IDENTITY.owner.userId,
    organization: { id: PROJECTION_IDENTITY.owner.organizationId },
    permissions: ["field_event.sync", "field.bootstrap", "field.upload", "sample.collect"],
  };
}
export function sampleCatalog() {
  return { version: "catalog-sample-v1", items: [], sampleOrigins: [SAMPLE_ORIGIN] };
}
