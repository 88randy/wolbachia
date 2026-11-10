import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { isCoordinates, isRecord } from "../day/assignment-parser.ts";
import { captureLocalDate } from "../day/capture-local-date.ts";
import { permitCovers } from "./geometry.ts";
import { ReleaseError } from "./types.ts";
import type { ReleaseCustody, ReleaseDraft, ReleasePins } from "./types.ts";

export interface ReleaseGate {
  readonly name:
    "permit" | "zone" | "lot" | "training" | "schedule" | "gps" | "device" | "configuration";
  readonly state: "pass" | "fail" | "unavailable";
  readonly detailKey?: MessageKey;
  readonly contact: "supervisor" | "admin" | "courier";
}
export interface CachedReleaseInput {
  readonly permit: Schemas["PermitBundle"] | null;
  readonly eligibility: Schemas["EligibilityBundle"] | null;
  readonly gps: FieldEventEnvelope["gps"];
  readonly now: Date;
  readonly isConfigured: boolean;
}
function unavailable(name: ReleaseGate["name"], detailKey: MessageKey): ReleaseGate {
  const contact = name === "configuration" ? "admin" : name === "gps" ? "courier" : "supervisor";
  return { name, state: "unavailable", detailKey, contact };
}
function interval(start: string | null, end: string | null, now: Date): boolean {
  if (start === null || end === null) return false;
  return Date.parse(start) <= now.getTime() && now.getTime() < Date.parse(end);
}
function permitGate(input: CachedReleaseInput): ReleaseGate {
  if (!input.permit?.permit_version_id)
    return unavailable("permit", "mobile.release.detailPermitUnavailable");
  if (input.permit.blocked_by.length)
    return {
      name: "permit",
      state: "fail",
      detailKey: "mobile.release.detailPermitBlocked",
      contact: "supervisor",
    };
  return interval(input.permit.valid_from, input.permit.valid_to, input.now)
    ? { name: "permit", state: "pass", contact: "supervisor" }
    : {
        name: "permit",
        state: "fail",
        detailKey: "mobile.release.detailPermitExpired",
        contact: "supervisor",
      };
}
function trainingGate(input: CachedReleaseInput): ReleaseGate {
  const eligibility = input.eligibility;
  if (
    !eligibility ||
    !input.permit ||
    !eligibility.requirement_version_id ||
    !eligibility.assessment_receipt
  )
    return unavailable("training", "mobile.release.detailTrainingUnavailable");
  return qualifiedTraining(eligibility, input)
    ? { name: "training", state: "pass", contact: "supervisor" }
    : {
        name: "training",
        state: "fail",
        detailKey: "mobile.release.detailTrainingBlocked",
        contact: "supervisor",
      };
}
function matchingTraining(
  eligibility: Schemas["EligibilityBundle"],
  permit: Schemas["PermitBundle"] | null,
) {
  if (!permit) return false;
  return (
    eligibility.center_id === permit.center_id &&
    (eligibility.quadrant_id === null || eligibility.quadrant_id === permit.quadrant_id)
  );
}
function qualifiedTraining(
  eligibility: Schemas["EligibilityBundle"],
  input: CachedReleaseInput,
): boolean {
  return (
    eligibility.action === "release.record" &&
    eligibility.training_eligible &&
    matchingTraining(eligibility, input.permit) &&
    eligibility.blockers.length === 0 &&
    eligibility.training_version_ids.length > 0 &&
    interval(eligibility.valid_from, eligibility.valid_until, input.now) &&
    (eligibility.next_change_at === null ||
      input.now.getTime() < Date.parse(eligibility.next_change_at))
  );
}
type PreciseGps = NonNullable<CachedReleaseInput["gps"]> & { readonly accuracy_m: number };
function usableGps(gps: CachedReleaseInput["gps"]): gps is PreciseGps {
  return (
    !!gps &&
    isCoordinates(gps.lat, gps.lng) &&
    typeof gps.accuracy_m === "number" &&
    Number.isFinite(gps.accuracy_m) &&
    gps.accuracy_m > 0
  );
}
function accuracyLimit(requirements: unknown): number | null {
  if (
    !isRecord(requirements) ||
    typeof requirements.max_gps_accuracy_m !== "number" ||
    !Number.isFinite(requirements.max_gps_accuracy_m) ||
    requirements.max_gps_accuracy_m <= 0
  )
    return null;
  return requirements.max_gps_accuracy_m;
}
function gpsGate(input: CachedReleaseInput): ReleaseGate {
  const gps = input.gps,
    limit = accuracyLimit(input.permit?.requirements);
  if (!usableGps(gps)) return unavailable("gps", "mobile.release.detailGpsUnavailable");
  if (limit === null) return unavailable("gps", "mobile.release.detailConfigurationUnavailable");
  return gps.accuracy_m <= limit
    ? { name: "gps", state: "pass", contact: "courier" }
    : {
        name: "gps",
        state: "fail",
        detailKey: "mobile.release.detailGpsAccuracy",
        contact: "courier",
      };
}
function zoneGate(input: CachedReleaseInput): ReleaseGate {
  if (!input.gps || !isCoordinates(input.gps.lat, input.gps.lng))
    return unavailable("zone", "mobile.release.detailZoneUnavailable");
  const covered = permitCovers(input.permit?.geometry, [input.gps.lng, input.gps.lat]);
  if (covered === null) return unavailable("zone", "mobile.release.detailZoneUnavailable");
  return covered
    ? { name: "zone", state: "pass", contact: "supervisor" }
    : {
        name: "zone",
        state: "fail",
        detailKey: "mobile.release.detailZoneOutside",
        contact: "supervisor",
      };
}
/** Missing producer facts are explicit denial, never inferred from planned quantities or a quadrant. */
export function cachedReleaseGates(input: CachedReleaseInput): readonly ReleaseGate[] {
  return [
    permitGate(input),
    zoneGate(input),
    unavailable("lot", "mobile.release.detailLotUnavailable"),
    trainingGate(input),
    unavailable("schedule", "mobile.release.detailScheduleUnavailable"),
    gpsGate(input),
    unavailable("device", "mobile.release.detailDeviceUnavailable"),
    input.isConfigured
      ? { name: "configuration", state: "pass", contact: "admin" }
      : unavailable("configuration", "mobile.release.detailConfigurationUnavailable"),
  ];
}
export function canSaveRelease(gates: readonly ReleaseGate[]): boolean {
  const names = ["permit", "zone", "lot", "training", "schedule", "gps", "device", "configuration"];
  return names.every(
    (name) =>
      gates.filter((gate) => gate.name === name).length === 1 &&
      gates.find((gate) => gate.name === name)?.state === "pass",
  );
}

const QUANTITY_DECIMALS = 6;
const QUANTITY_SCALE = 1_000_000n;
const QUANTITY_WHOLE_DIGITS = 14;
const MAX_RELEASE_EVIDENCE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decimal(20,6) without floating-point rounding, separators or exponent notation. */
export function quantityUnits(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole = "", fraction = ""] = value.split(".");
  const significantWhole = whole.replace(/^0+/, "") || "0";
  if (significantWhole.length > QUANTITY_WHOLE_DIGITS) return null;
  return (
    BigInt(significantWhole) * QUANTITY_SCALE + BigInt(fraction.padEnd(QUANTITY_DECIMALS, "0"))
  );
}
/** Exact decimal text for local quantity reservations; never converts through Number. */
export function quantityText(units: bigint): string {
  const sign = units < 0n ? "-" : "";
  const magnitude = units < 0n ? -units : units;
  const fraction = String(magnitude % QUANTITY_SCALE)
    .padStart(QUANTITY_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${sign}${String(magnitude / QUANTITY_SCALE)}${fraction ? `.${fraction}` : ""}`;
}
export interface ReleaseGateInput {
  readonly draft: ReleaseDraft;
  readonly current: ReleasePins | null;
  readonly now: Date;
  readonly availableQuantity: string;
  readonly taskCaptured: boolean;
}
function failed(name: ReleaseGate["name"], detailKey: MessageKey): ReleaseGate {
  return { name, state: "fail", detailKey, contact: "supervisor" };
}
function passed(name: ReleaseGate["name"]): ReleaseGate {
  return { name, state: "pass", contact: "supervisor" };
}
function atOrBefore(value: string, at: Date): boolean {
  const instant = Date.parse(value);
  return Number.isFinite(instant) && instant <= at.getTime();
}
function samePermit(original: ReleasePins, current: ReleasePins): boolean {
  return (
    original.permit.id === current.permit.id &&
    original.permit.center_id === current.permit.center_id &&
    original.permit.quadrant_id === current.permit.quadrant_id
  );
}
function configuredDraft(draft: ReleaseDraft): boolean {
  return (
    !!draft.ownerKey &&
    !!draft.catalogVersion &&
    !!draft.rulesVersion &&
    [draft.eventId, draft.shiftId, draft.trainingVersionId].every((id) => UUID.test(id)) &&
    captureLocalDate(draft.deviceTime, draft.timezone) !== null
  );
}
function configuredPins(pins: ReleasePins, at: Date): boolean {
  const capture = pins.permit.capture;
  return (
    !!capture &&
    !!pins.captureVersion &&
    capture.version === pins.captureVersion &&
    atOrBefore(capture.as_of, at) &&
    capture.devices.some(({ id }) => id === pins.device.id) &&
    capture.tasks.some(({ id }) => id === pins.task.id)
  );
}
function captureInput(draft: ReleaseDraft, pins: ReleasePins | null, at: Date): CachedReleaseInput {
  return {
    permit: pins?.permit ?? null,
    eligibility: pins?.eligibility ?? null,
    gps: draft.gps,
    now: at,
    isConfigured: configuredDraft(draft) && pins !== null && configuredPins(pins, at),
  };
}
function baseReleaseGates(input: ReleaseGateInput): readonly ReleaseGate[] {
  const capture = new Date(input.draft.deviceTime);
  const original = cachedReleaseGates(captureInput(input.draft, input.draft.pins, capture));
  const current = cachedReleaseGates(captureInput(input.draft, input.current, input.now));
  return original.map((gate) =>
    gate.state === "pass" ? (current.find(({ name }) => name === gate.name) ?? gate) : gate,
  );
}
function declaredTraining(input: ReleaseGateInput): ReleaseGate | null {
  const original = input.draft.pins,
    current = input.current;
  if (current === null) return unavailable("training", "mobile.release.detailTrainingUnavailable");
  const pins = [original, current];
  const valid = pins.every(
    ({ eligibility, task }) =>
      eligibility.subject_id === task.courier_id &&
      eligibility.organization_id === original.eligibility.organization_id &&
      eligibility.training_version_ids.includes(input.draft.trainingVersionId),
  );
  return valid ? null : failed("training", "mobile.release.detailTrainingPinInvalid");
}
function sameDevice(original: ReleasePins["device"], current: ReleasePins["device"]): boolean {
  return (
    original.id === current.id &&
    original.source_lot_id === current.source_lot_id &&
    original.source_lot_version_id === current.source_lot_version_id &&
    original.created_at === current.created_at &&
    current.revision >= original.revision
  );
}
function matchingDevice(input: ReleaseGateInput): ReleaseGate {
  const original = input.draft.pins.device,
    current = input.current?.device;
  if (!current) return unavailable("device", "mobile.release.detailDeviceUnavailable");
  if (original.status !== "active" || current.status !== "active")
    return failed("device", "mobile.release.detailDeviceBlocked");
  return sameDevice(original, current) &&
    atOrBefore(original.created_at, new Date(input.draft.deviceTime))
    ? passed("device")
    : failed("device", "mobile.release.detailPinsChanged");
}
function taskBinding(pins: ReleasePins, capture: Date): boolean {
  const { task, permit } = pins;
  return (
    task.permit_id === permit.id &&
    task.permit_version_id === permit.permit_version_id &&
    task.courier_id === pins.eligibility.subject_id &&
    !task.is_completed &&
    [task.created_at, task.binding_created_at, task.owner_created_at].every((at) =>
      atOrBefore(at, capture),
    )
  );
}
function matchingTask(input: ReleaseGateInput): ReleaseGate {
  const original = input.draft.pins,
    current = input.current;
  if (!current) return unavailable("schedule", "mobile.release.detailScheduleUnavailable");
  const capture = new Date(input.draft.deviceTime);
  const day = captureLocalDate(input.draft.deviceTime, input.draft.timezone);
  const same = sameTask({ original, current, day });
  return same &&
    !input.taskCaptured &&
    taskBinding(original, capture) &&
    taskBinding(current, capture)
    ? passed("schedule")
    : failed("schedule", "mobile.release.detailScheduleBlocked");
}
function sameTask(input: {
  readonly original: ReleasePins;
  readonly current: ReleasePins;
  readonly day: string | null;
}): boolean {
  const original = input.original.task,
    current = input.current.task;
  return (
    original.id === current.id &&
    original.point_id === current.point_id &&
    original.courier_id === current.courier_id &&
    original.owner_revision === current.owner_revision &&
    original.due_date === input.day &&
    current.due_date === input.day &&
    original.permit_version_id === current.permit_version_id
  );
}
function transitReady(custody: ReleaseCustody): boolean {
  return (
    custody.transit_policy_id !== null &&
    custody.transit_mode === "manual_evidence_review" &&
    custody.requires_evidence &&
    custody.proof_roles.length === 1 &&
    custody.proof_roles[0] === "photo"
  );
}
function sameCustody(original: ReleaseCustody, current: ReleaseCustody): boolean {
  const keys = [
    "receipt_line_id",
    "receipt_source_event_id",
    "assignment_id",
    "assignment_date",
    "shift_id",
    "unit_version_id",
    "piece_id",
    "received_at",
    "source_lot_version_id",
    "transit_policy_id",
    "transit_mode",
  ] as const;
  return keys.every((key) => original[key] === current[key]);
}
function receiptMatches(input: ReleaseGateInput): boolean {
  const { custody, device } = input.draft.pins;
  const sameShift =
    custody.shift_id === input.draft.shiftId ||
    (custody.shift_id === null &&
      custody.assignment_date === captureLocalDate(input.draft.deviceTime, input.draft.timezone));
  return (
    sameShift &&
    custody.source_lot_version_id === device.source_lot_version_id &&
    atOrBefore(custody.received_at, new Date(input.draft.deviceTime))
  );
}
function beforeExpiry(expiry: string | null, at: Date): boolean {
  return expiry === null || at.getTime() < Date.parse(expiry);
}
function hasReleaseEvidence(draft: ReleaseDraft): boolean {
  return (
    draft.evidence.length > 0 &&
    draft.evidence.length <= MAX_RELEASE_EVIDENCE &&
    new Set(draft.evidence.map(({ id }) => id)).size === draft.evidence.length &&
    draft.evidence.every(({ id, fileRef }) => UUID.test(id) && fileRef.length > 0)
  );
}
function stockFits(input: ReleaseGateInput): boolean {
  const quantity = quantityUnits(input.draft.quantity);
  if (quantity === null || quantity <= 0n || input.current === null) return false;
  const limits = [
    input.availableQuantity,
    input.draft.pins.custody.available_quantity,
    input.current.custody.available_quantity,
  ].map(quantityUnits);
  return (
    limits.every((limit) => limit !== null && quantity <= limit) &&
    (input.current.custody.piece_id === null || quantity === QUANTITY_SCALE)
  );
}
function lotPrerequisite(input: ReleaseGateInput): ReleaseGate {
  const original = input.draft.pins,
    current = input.current;
  if (!current) return unavailable("lot", "mobile.release.detailLotUnavailable");
  if (!matchingCustody(input)) return failed("lot", "mobile.release.detailPinsChanged");
  if (!lotPolicyReady(original.custody, current.custody))
    return failed("lot", "mobile.release.detailLotBlocked");
  if (!lotUnexpired(input)) return failed("lot", "mobile.release.detailLotExpired");
  if (!hasReleaseEvidence(input.draft))
    return failed("lot", "mobile.release.detailEvidenceRequired");
  if (!stockFits(input)) return failed("lot", "mobile.release.detailStockUnavailable");
  return passed("lot");
}
function matchingCustody(input: ReleaseGateInput): boolean {
  const original = input.draft.pins,
    current = input.current;
  return (
    current !== null &&
    sameCustody(original.custody, current.custody) &&
    receiptMatches(input) &&
    current.custody.source_lot_version_id === current.device.source_lot_version_id
  );
}
function lotPolicyReady(original: ReleaseCustody, current: ReleaseCustody): boolean {
  return (
    original.blocked_by.length === 0 &&
    current.blocked_by.length === 0 &&
    transitReady(original) &&
    transitReady(current)
  );
}
function lotUnexpired(input: ReleaseGateInput): boolean {
  const capture = new Date(input.draft.deviceTime),
    original = input.draft.pins.custody;
  return (
    input.current !== null &&
    beforeExpiry(original.source_expires_at, capture) &&
    beforeExpiry(original.current_expires_at, capture) &&
    beforeExpiry(input.current.custody.current_expires_at, input.now)
  );
}
/** Every new save rechecks original capture facts and current downloaded safety, without overrides. */
export function releaseGates(input: ReleaseGateInput): readonly ReleaseGate[] {
  const replacements: Partial<Record<ReleaseGate["name"], ReleaseGate>> = {
    lot: lotPrerequisite(input),
    device: matchingDevice(input),
    schedule: matchingTask(input),
  };
  const training = declaredTraining(input);
  if (training !== null) replacements.training = training;
  if (input.current !== null && !samePermit(input.draft.pins, input.current))
    replacements.permit = failed("permit", "mobile.release.detailPinsChanged");
  if (quantityUnits(input.draft.quantity) === null || quantityUnits(input.draft.quantity) === 0n)
    replacements.lot = failed("lot", "mobile.release.detailQuantityInvalid");
  return baseReleaseGates(input).map((gate) => replacements[gate.name] ?? gate);
}
function requireReleaseDraft(draft: ReleaseDraft): void {
  if (!configuredDraft(draft)) throw new ReleaseError("context_unavailable");
  const quantity = quantityUnits(draft.quantity);
  if (quantity === null || quantity <= 0n) throw new ReleaseError("quantity_invalid");
  if (!hasReleaseEvidence(draft)) throw new ReleaseError("evidence_required");
  if (!usableGps(draft.gps)) throw new ReleaseError("gps_unusable");
  const gates = releaseGates({
    draft,
    current: draft.pins,
    now: new Date(draft.deviceTime),
    availableQuantity: draft.pins.custody.available_quantity,
    taskCaptured: false,
  });
  if (!canSaveRelease(gates)) throw new ReleaseError("safety_blocked");
}
/** Builds the original immutable declaration only; saving and transport belong to the existing outbox. */
export function releaseEvent(draft: ReleaseDraft): FieldEventEnvelope {
  requireReleaseDraft(draft);
  return {
    id: draft.eventId,
    type: "release.record",
    schema_version: 1,
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: draft.gps === null || draft.gps === undefined ? null : { ...draft.gps },
    rules_version: draft.rulesVersion,
    catalog_version: draft.catalogVersion,
    manual_capture: draft.manualCapture,
    voids_event_id: null,
    payload: {
      permit_id: draft.pins.permit.id,
      release_device_id: draft.pins.device.id,
      lot_id: draft.pins.device.source_lot_id,
      quantity: draft.quantity,
      schedule_task_id: draft.pins.task.id,
      training_version: draft.trainingVersionId,
      evidence_ids: draft.evidence.map(({ id }) => id),
    },
  };
}
