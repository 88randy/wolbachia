import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { visibleLength, UUID_PATTERN } from "../ovitrap-check/domain.ts";
import type { SampleProjectionSource } from "./projection.ts";
import type { SampleDraft, SampleMethod, SampleSource, SampleSourceRef } from "./types.ts";

const CODE_LIMIT = 50;
const OTHER_LIMIT = 1000;
function atOrBefore(value: string | null, instant: string): boolean {
  return value !== null && Date.parse(value) <= Date.parse(instant);
}
export function sameSource(left: SampleSourceRef, right: SampleSourceRef): boolean {
  return left.kind === right.kind && left.id.toLowerCase() === right.id.toLowerCase();
}
export function methodVerified(method: SampleMethod, instant: string): boolean {
  return (
    method.supports_wolbachia &&
    method.verification.content_hash === method.content_hash &&
    atOrBefore(method.created_at, instant) &&
    atOrBefore(method.effective_from, instant) &&
    atOrBefore(method.verification.created_at, instant)
  );
}
export function sourceEffective(source: SampleSource, userId: string, instant: string): boolean {
  if (!source.effective || !atOrBefore(source.created_at, instant)) return false;
  if (source.kind === "lot") return atOrBefore(source.lot_version_created_at, instant);
  return source.author_id === userId && atOrBefore(source.device_time, instant);
}
export function snapshotCurrent(source: SampleProjectionSource, instant: string): boolean {
  const snapshot = source.snapshot;
  return (
    atOrBefore(snapshot.as_of, instant) &&
    (snapshot.valid_until === null || Date.parse(instant) < Date.parse(snapshot.valid_until))
  );
}
export function sampleSources(source: SampleProjectionSource, instant: string) {
  if (!snapshotCurrent(source, instant)) return [];
  return source.snapshot.sources.filter((entry) =>
    sourceEffective(entry, source.handle.owner.userId, instant),
  );
}
export function hasSampleConfiguration(source: SampleProjectionSource): boolean {
  return Boolean(source.catalogVersion && source.rulesVersion && source.origins.length);
}
function hasMeasuredGps(gps: SampleDraft["gps"]): boolean {
  return (
    gps != null &&
    Number.isFinite(gps.lat) &&
    Math.abs(gps.lat) <= 90 &&
    Number.isFinite(gps.lng) &&
    Math.abs(gps.lng) <= 180 &&
    typeof gps.accuracy_m === "number" &&
    Number.isFinite(gps.accuracy_m) &&
    gps.accuracy_m > 0
  );
}
function validOrigin(draft: SampleDraft, source: SampleProjectionSource): boolean {
  return (
    draft.origin !== null &&
    draft.origin.code === draft.originCode &&
    source.origins.some(({ code }) => code === draft.originCode)
  );
}
function validMethod(draft: SampleDraft, source: SampleProjectionSource): boolean {
  const original = draft.method,
    current = source.snapshot.methods.find(({ id }) => id === draft.methodVersion);
  return (
    original !== null &&
    current !== undefined &&
    original.id === draft.methodVersion &&
    original.content_hash === current.content_hash &&
    methodVerified(original, draft.deviceTime) &&
    methodVerified(current, draft.deviceTime)
  );
}
function validSource(draft: SampleDraft, source: SampleProjectionSource): boolean {
  const current = source.snapshot.sources.find((entry) => sameSource(entry, draft.sourceRef));
  return (
    current !== undefined &&
    JSON.stringify(current) === JSON.stringify(draft.source) &&
    sourceEffective(draft.source, source.handle.owner.userId, draft.deviceTime)
  );
}
function validOther(draft: SampleDraft): boolean {
  const normalized = draft.otherText.normalize("NFC").replaceAll("\r\n", "\n").trim();
  if (
    /[\p{Cs}\u202a-\u202e\u2066-\u2069]/u.test(normalized) ||
    /\p{Cc}/u.test(normalized.replaceAll("\n", ""))
  )
    return false;
  return draft.origin?.is_other === true
    ? visibleLength(normalized) > 0 && Array.from(normalized).length <= OTHER_LIMIT
    : normalized.length === 0;
}
function needsEvidence(draft: SampleDraft, source: SampleProjectionSource): boolean {
  return (
    draft.origin?.requires_photo === true ||
    source.origins.some((origin) => origin.code === draft.originCode && origin.requires_photo)
  );
}
/** Original proof remains pinned; downloaded current facts can only remove authority. */
export function sampleGates(draft: SampleDraft, source: SampleProjectionSource): readonly string[] {
  const checks: readonly [string, boolean][] = [
    ["configuration", hasSampleConfiguration(source) && snapshotCurrent(source, draft.deviceTime)],
    ["source", validSource(draft, source)],
    ["origin", validOrigin(draft, source)],
    ["method", validMethod(draft, source)],
    ["code", draft.code.trim().length > 0 && Array.from(draft.code.trim()).length <= CODE_LIMIT],
    ["other", validOther(draft)],
    ["gps", hasMeasuredGps(draft.gps)],
    [
      "evidence",
      draft.evidence.length <= 20 && (!needsEvidence(draft, source) || draft.evidence.length > 0),
    ],
    ["scope", source.canUpload],
  ];
  return checks.filter(([, passes]) => !passes).map(([code]) => code);
}
export function sampleEvent(draft: SampleDraft): FieldEventEnvelope {
  return {
    id: draft.eventId,
    type: "sample.collect",
    schema_version: 1,
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: draft.gps,
    manual_capture: draft.manualCapture,
    voids_event_id: null,
    catalog_version: draft.catalogVersion,
    rules_version: draft.rulesVersion,
    payload: {
      sample_id: draft.sampleId,
      code: draft.code.trim(),
      origin_code: draft.originCode,
      method_version: draft.methodVersion,
      source_ref: draft.sourceRef,
      ...(draft.otherText.trim() ? { other_text: draft.otherText.trim() } : {}),
      evidence_ids: draft.evidence.map(({ id }) => id),
    },
  };
}
export function validSampleId(value: string): boolean {
  return UUID_PATTERN.test(value);
}
