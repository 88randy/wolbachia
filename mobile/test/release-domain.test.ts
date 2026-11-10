import assert from "node:assert/strict";
import { test } from "node:test";
import type { Schemas } from "@wolbachia/api-client";
import {
  cachedReleaseGates,
  canSaveRelease,
  quantityUnits,
  quantityText,
  releaseGates,
  releaseEvent,
} from "../src/features/releases/domain.ts";
import type { CachedReleaseInput, ReleaseGateInput } from "../src/features/releases/domain.ts";
import { ReleaseError } from "../src/features/releases/types.ts";
import type { ReleaseDraft, ReleasePins } from "../src/features/releases/types.ts";
import { permitCovers } from "../src/features/releases/geometry.ts";
import { parseAssignment } from "../src/features/day/assignment-parser.ts";
import type { ReleaseTask } from "../src/features/releases/projection-contract.ts";

const NOW = new Date("2026-11-09T16:00:00Z");
const POLYGON = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
    [
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
      [2, 2],
    ],
  ],
};
function fixture() {
  const permit = {
    id: "permit",
    code: "P-1",
    version: "opaque",
    permit_version_id: "permit-version",
    permit_type_id: "type",
    revision: 1,
    center_id: "center",
    quadrant_id: "quadrant",
    geometry: POLYGON,
    valid_from: "2026-11-09T15:00:00Z",
    valid_to: "2026-11-09T17:00:00Z",
    requirements: { max_gps_accuracy_m: 8 },
    blocked_by: [],
    capture: null,
  } satisfies Schemas["PermitBundle"];
  const eligibility = {
    id: "eligibility",
    subject_id: "courier",
    organization_id: "organization",
    action: "release.record",
    center_id: "center",
    quadrant_id: "quadrant",
    training_eligible: true,
    requirement_version_id: "requirement",
    certification_ids: ["cert"],
    training_version_ids: ["training"],
    revocation_ids: [],
    valid_from: permit.valid_from,
    valid_until: permit.valid_to,
    next_change_at: null,
    blockers: [],
    assessment_receipt: "receipt",
    version: "opaque",
  } satisfies Schemas["EligibilityBundle"];
  return {
    permit,
    eligibility,
    gps: { lat: 1, lng: 1, accuracy_m: 8 },
    now: NOW,
    isConfigured: true,
  };
}
function state(input: CachedReleaseInput, name: string) {
  return cachedReleaseGates(input).find((gate) => gate.name === name)?.state;
}
void test("official polygon covers exterior/hole boundaries but excludes holes and unsupported geometry", () => {
  for (const point of [
    [1, 1],
    [0, 5],
    [2, 2],
  ] as const)
    assert.equal(permitCovers(POLYGON, point), true);
  for (const point of [
    [3, 3],
    [-1, 5],
  ] as const)
    assert.equal(permitCovers(POLYGON, point), false);
  for (const geometry of [
    null,
    { type: "MultiPolygon", coordinates: [] },
    {
      type: "Polygon",
      coordinates: [
        [
          [179, 0],
          [-179, 0],
          [-179, 1],
          [179, 0],
        ],
      ],
    },
    {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      ],
    },
  ])
    assert.equal(permitCovers(geometry, [0, 0]), null);
});

function id(number: number): string {
  return `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}
function pins(): ReleasePins {
  const cached = fixture();
  const custody: Schemas["ReleaseCaptureCustody"] = {
    receipt_line_id: id(10),
    receipt_source_event_id: id(11),
    assignment_id: id(12),
    assignment_date: "2026-11-09",
    shift_id: id(13),
    unit_version_id: id(14),
    piece_id: null,
    available_quantity: "10.000000",
    received_at: "2026-11-09T15:00:00Z",
    source_lot_version_id: id(15),
    current_lot_version_id: id(16),
    source_expires_at: "2026-11-10T00:00:00Z",
    current_expires_at: "2026-11-10T00:00:00Z",
    transit_policy_id: id(17),
    transit_mode: "manual_evidence_review",
    proof_roles: ["photo"],
    requires_evidence: true,
    blocked_by: [],
    accounted_release_event_ids: [],
  };
  const device: Schemas["ReleaseCaptureDevice"] = {
    id: id(18),
    code: "DEV-139",
    status: "active",
    revision: 1,
    created_at: "2026-11-09T14:00:00Z",
    source_lot_id: id(19),
    source_lot_version_id: id(15),
    custody: [custody],
  };
  const task: Schemas["ReleaseCaptureTask"] = {
    id: id(20),
    point_id: id(21),
    permit_id: id(22),
    permit_version_id: id(23),
    courier_id: id(24),
    due_date: "2026-11-09",
    owner_revision: 1,
    is_completed: false,
    created_at: "2026-11-09T14:00:00Z",
    binding_created_at: "2026-11-09T14:00:00Z",
    owner_created_at: "2026-11-09T14:00:00Z",
  };
  const capture = {
    as_of: "2026-11-09T15:00:00Z",
    version: "capture-139",
    devices: [device],
    tasks: [task],
  };
  const permit = { ...cached.permit, id: id(22), permit_version_id: id(23), capture };
  const eligibility = { ...cached.eligibility, subject_id: id(24), training_version_ids: [id(25)] };
  return { permit, eligibility, device, task, custody, captureVersion: capture.version };
}
function releaseDraft(patch: Partial<ReleaseDraft> = {}): ReleaseDraft {
  return {
    eventId: id(26),
    ownerKey: "synthetic-owner",
    shiftId: id(13),
    deviceTime: NOW.toISOString(),
    catalogVersion: "catalog-139",
    rulesVersion: "rules-139",
    trainingVersionId: id(25),
    timezone: "America/Mexico_City",
    manualCapture: false,
    pins: pins(),
    quantity: "2.000001",
    gps: { lat: 1, lng: 1, accuracy_m: 8 },
    evidence: [{ id: id(27), fileRef: "file:///private/release.png" }],
    ...patch,
  };
}
function fullInput(patch: Partial<ReleaseGateInput> = {}): ReleaseGateInput {
  const draft = releaseDraft();
  return {
    draft,
    current: structuredClone(draft.pins),
    now: NOW,
    availableQuantity: "10",
    taskCaptured: false,
    ...patch,
  };
}
function fullState(input: ReleaseGateInput, gate: string) {
  return releaseGates(input).find(({ name }) => name === gate)?.state;
}

void test("release decimal20,6 quantities retain every micro-unit at the largest allowed value", () => {
  for (const [text, units] of [
    ["0", 0n],
    ["0.000001", 1n],
    ["1.000001", 1_000_001n],
    ["99999999999999.999999", 99_999_999_999_999_999_999n],
  ] as const) {
    assert.equal(quantityUnits(text), units);
    assert.equal(quantityUnits(quantityText(units)), units);
  }
  for (const text of [
    "",
    "-1",
    "NaN",
    "Infinity",
    "1e2",
    "1,000",
    "1.0000001",
    "100000000000000",
    " 1 ",
  ])
    assert.equal(quantityUnits(text), null);
  const input = fullInput();
  assert.equal(fullState({ ...input, draft: { ...input.draft, quantity: "0" } }, "lot"), "fail");
  assert.equal(fullState({ ...input, availableQuantity: "2.000000" }, "lot"), "fail");
  assert.equal(fullState({ ...input, availableQuantity: "2.000001" }, "lot"), "pass");
});

void test("complete genuine release pins permit only the original safety declaration and exact server payload", () => {
  const input = fullInput();
  assert.equal(canSaveRelease(releaseGates(input)), true);
  const before = structuredClone(input.draft);
  const event = releaseEvent(input.draft);
  assert.deepEqual(event, {
    id: input.draft.eventId,
    type: "release.record",
    schema_version: 1,
    device_time: input.draft.deviceTime,
    shift_id: input.draft.shiftId,
    gps: input.draft.gps,
    rules_version: "rules-139",
    catalog_version: "catalog-139",
    manual_capture: false,
    voids_event_id: null,
    payload: {
      permit_id: id(22),
      release_device_id: id(18),
      lot_id: id(19),
      quantity: "2.000001",
      schedule_task_id: id(20),
      training_version: id(25),
      evidence_ids: [id(27)],
    },
  });
  assert.deepEqual(input.draft, before);
  assert.notEqual(event.gps, input.draft.gps, "the envelope owns its GPS values");
  assert.throws(
    () => releaseEvent({ ...input.draft, evidence: [] }),
    (error) => error instanceof ReleaseError && error.code === "evidence_required",
  );
  assert.throws(
    () => releaseEvent({ ...input.draft, quantity: "1.0000001" }),
    (error) => error instanceof ReleaseError && error.code === "quantity_invalid",
  );
});

void test("original and current permit, geometry, training and GPS safety both remain non-overridable", () => {
  const input = fullInput(),
    current = input.current;
  assert.ok(current);
  const cases: readonly [ReleasePins, string][] = [
    [{ ...current, permit: { ...current.permit, blocked_by: ["permit_suspended"] } }, "permit"],
    [{ ...current, permit: { ...current.permit, valid_to: NOW.toISOString() } }, "permit"],
    [{ ...current, permit: { ...current.permit, id: id(90) } }, "permit"],
    [
      {
        ...current,
        permit: {
          ...current.permit,
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [20, 20],
                [21, 20],
                [21, 21],
                [20, 20],
              ],
            ],
          },
        },
      },
      "zone",
    ],
    [
      { ...current, permit: { ...current.permit, requirements: { max_gps_accuracy_m: 7.99 } } },
      "gps",
    ],
    [{ ...current, eligibility: { ...current.eligibility, training_eligible: false } }, "training"],
    [
      { ...current, eligibility: { ...current.eligibility, training_version_ids: [id(91)] } },
      "training",
    ],
    [
      { ...current, eligibility: { ...current.eligibility, valid_until: NOW.toISOString() } },
      "training",
    ],
  ];
  for (const [changed, gate] of cases) {
    assert.equal(fullState({ ...input, current: changed }, gate), "fail");
    assert.equal(canSaveRelease(releaseGates({ ...input, current: changed })), false);
  }
  const original = {
    ...input.draft.pins,
    eligibility: { ...input.draft.pins.eligibility, training_eligible: false },
  };
  assert.equal(
    fullState({ ...input, draft: { ...input.draft, pins: original } }, "training"),
    "fail",
  );
  assert.equal(canSaveRelease(releaseGates({ ...input, current: null })), false);
});

void test("release task binding, ownership, equipment source and genuine receipt identity cannot change beneath a draft", () => {
  const input = fullInput(),
    current = input.current;
  assert.ok(current);
  for (const patch of [
    { permit_id: id(90) },
    { permit_version_id: id(90) },
    { courier_id: id(90) },
    { owner_revision: 2 },
    { due_date: "2026-11-10" },
    { is_completed: true },
    { binding_created_at: "2026-11-09T16:00:01Z" },
    { owner_created_at: "2026-11-09T16:00:01Z" },
  ])
    assert.equal(
      fullState(
        { ...input, current: { ...current, task: { ...current.task, ...patch } } },
        "schedule",
      ),
      "fail",
    );
  assert.equal(fullState({ ...input, taskCaptured: true }, "schedule"), "fail");
  for (const patch of [
    { status: "inactive" as const },
    { status: "retired" as const },
    { source_lot_version_id: id(90) },
    { source_lot_id: id(90) },
    { created_at: "2026-11-09T16:00:01Z" },
  ])
    assert.equal(
      fullState(
        { ...input, current: { ...current, device: { ...current.device, ...patch } } },
        "device",
      ),
      "fail",
    );
  for (const patch of [
    { receipt_line_id: id(90) },
    { receipt_source_event_id: id(90) },
    { assignment_id: id(90) },
    { unit_version_id: id(90) },
    { shift_id: id(90) },
    { transit_policy_id: id(90) },
  ])
    assert.equal(
      fullState(
        { ...input, current: { ...current, custody: { ...current.custody, ...patch } } },
        "lot",
      ),
      "fail",
    );
});

void test("release lot safety, exact custody, piece quantity and required photo cannot be inferred from a plan", () => {
  const input = fullInput(),
    current = input.current;
  assert.ok(current);
  for (const patch of [
    { blocked_by: ["condition_breach"] },
    { blocked_by: ["lot_incomplete"] },
    { current_expires_at: NOW.toISOString() },
    { transit_mode: "unsupported" },
    { transit_policy_id: null },
    { proof_roles: [] },
    { requires_evidence: false },
    { available_quantity: "2" },
  ])
    assert.equal(
      fullState(
        { ...input, current: { ...current, custody: { ...current.custody, ...patch } } },
        "lot",
      ),
      "fail",
    );
  const capturedExpired = {
    ...input.draft.pins,
    custody: { ...input.draft.pins.custody, source_expires_at: NOW.toISOString() },
  };
  assert.equal(
    fullState({ ...input, draft: { ...input.draft, pins: capturedExpired } }, "lot"),
    "fail",
  );
  assert.equal(fullState({ ...input, draft: { ...input.draft, evidence: [] } }, "lot"), "fail");
  const piecePins = { ...current, custody: { ...current.custody, piece_id: id(90) } };
  const pieceDraft = { ...input.draft, pins: piecePins, quantity: "1" };
  assert.equal(fullState({ ...input, draft: pieceDraft, current: piecePins }, "lot"), "pass");
  assert.equal(
    fullState({ ...input, draft: { ...pieceDraft, quantity: "2" }, current: piecePins }, "lot"),
    "fail",
  );
});

void test("release day and unbound-shift custody use the immutable organization timezone across UTC midnight", () => {
  const draft = releaseDraft({ deviceTime: "2026-11-10T01:00:00Z" });
  const original = draft.pins;
  const changed = {
    ...original,
    permit: { ...original.permit, valid_to: "2026-11-11T00:00:00Z" },
    eligibility: { ...original.eligibility, valid_until: "2026-11-11T00:00:00Z" },
    custody: {
      ...original.custody,
      shift_id: null,
      source_expires_at: null,
      current_expires_at: null,
    },
  };
  const input = fullInput({
    draft: { ...draft, pins: changed },
    current: changed,
    now: new Date(draft.deviceTime),
  });
  assert.equal(
    fullState(input, "schedule"),
    "pass",
    "Mexico City still has the captured scheduled day",
  );
  assert.equal(fullState(input, "lot"), "pass");
  const wrongDay = { ...changed, custody: { ...changed.custody, assignment_date: "2026-11-10" } };
  assert.equal(
    fullState({ ...input, draft: { ...input.draft, pins: wrongDay }, current: wrongDay }, "lot"),
    "fail",
  );
  assert.equal(
    fullState(
      { ...input, draft: { ...input.draft, timezone: "invalid-timezone" } },
      "configuration",
    ),
    "unavailable",
  );
});

void test("a future original server frame cannot authorize capture while a later current refresh is allowed", () => {
  const input = fullInput(),
    original = input.draft.pins;
  const capture = original.permit.capture;
  assert.ok(capture);
  const future = {
    ...original,
    permit: { ...original.permit, capture: { ...capture, as_of: "2026-11-09T16:00:01Z" } },
  };
  assert.equal(
    fullState({ ...input, draft: { ...input.draft, pins: future } }, "configuration"),
    "unavailable",
  );
  const current = {
    ...original,
    permit: { ...original.permit, capture: { ...capture, as_of: "2026-11-09T16:01:00Z" } },
  };
  assert.equal(
    canSaveRelease(releaseGates({ ...input, current, now: new Date("2026-11-09T16:05:00Z") })),
    true,
  );
});
void test("cached permit expiry and suspension fail closed at the exact validity boundaries", () => {
  const input = fixture(),
    permit = input.permit;
  assert.equal(state(input, "permit"), "pass");
  for (const now of [new Date("2026-11-09T14:59:59Z"), new Date(permit.valid_to)])
    assert.equal(state({ ...input, now }, "permit"), "fail");
  assert.equal(
    state({ ...input, permit: { ...permit, blocked_by: ["permit_suspended"] } }, "permit"),
    "fail",
  );
  assert.equal(state({ ...input, permit: null }, "permit"), "unavailable");
});
void test("release GPS needs a finite positive explicit accuracy policy and inclusive measured precision", () => {
  const input = fixture();
  assert.equal(state(input, "gps"), "pass");
  for (const accuracy_m of [null, 0, -1, Infinity, NaN])
    assert.equal(state({ ...input, gps: { lat: 1, lng: 1, accuracy_m } }, "gps"), "unavailable");
  assert.equal(state({ ...input, gps: { lat: 1, lng: 1, accuracy_m: 8.01 } }, "gps"), "fail");
  assert.equal(state({ ...input, gps: { lat: 91, lng: 1, accuracy_m: 1 } }, "gps"), "unavailable");
  assert.equal(
    state({ ...input, permit: { ...input.permit, requirements: {} } }, "gps"),
    "unavailable",
  );
  assert.equal(state({ ...input, gps: { lat: 3, lng: 3, accuracy_m: 1 } }, "zone"), "fail");
});
void test("training requires a delivered original assessment and valid matching release qualification", () => {
  const input = fixture(),
    eligibility = input.eligibility;
  assert.equal(state(input, "training"), "pass");
  assert.equal(
    state({ ...input, eligibility: { ...eligibility, assessment_receipt: null } }, "training"),
    "unavailable",
  );
  for (const patch of [
    { training_eligible: false },
    { training_version_ids: [] },
    { action: "ovitrap.check" },
    { valid_until: NOW.toISOString() },
    { next_change_at: NOW.toISOString() },
    { blockers: ["training_expired"] },
    { quadrant_id: "different-quadrant" },
  ])
    assert.equal(
      state({ ...input, eligibility: { ...eligibility, ...patch } }, "training"),
      "fail",
    );
});
void test("missing device, safe lot and explicit task binding cannot be bypassed by valid downloaded prerequisites", () => {
  const gates = cachedReleaseGates(fixture());
  for (const name of ["device", "lot", "schedule"])
    assert.equal(gates.find((gate) => gate.name === name)?.state, "unavailable");
  assert.equal(canSaveRelease(gates), false);
  assert.equal(canSaveRelease([]), false);
  assert.equal(
    canSaveRelease(
      gates.filter(({ name }) => name !== "lot").map((gate) => ({ ...gate, state: "pass" })),
    ),
    false,
  );
});

void test("assignments4 release work remains visible to the day list", () => {
  const task: ReleaseTask = {
    id: "task",
    kind: "task",
    code: "RELEASE-139",
    point: "point",
    quadrant_id: "quadrant",
    courier: "courier",
    action: "release",
    date: "2026-11-09",
    revision: 1,
    is_completed: false,
  };
  assert.equal(parseAssignment(task)?.action, "release");
});
