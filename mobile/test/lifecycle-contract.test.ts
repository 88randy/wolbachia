import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readHistoryChange,
  readHistoryEntry,
} from "../src/features/ovitrap-lifecycle/history-contract.ts";
import {
  readQuadrantChange,
  readQuadrantReference,
} from "../src/features/ovitrap-lifecycle/quadrant-contract.ts";
import { readCaptureContext } from "../src/features/ovitrap-lifecycle/capture-context-contract.ts";
import { CourierContractError } from "../src/features/ovitrap-lifecycle/contract-readers.ts";
import {
  CAPTURE_CONTEXT,
  CONTRACT_IDS as ID,
  QUADRANT_REFERENCE,
  LAB_RECEIPT,
  LAB_DISCREPANCY,
  LAB_COUNT,
  LAB_REJECTION,
  LAB_VOID,
  LAB_HISTORY,
  COMMUNITY_HISTORY,
  SUPPLY_HISTORY,
  RELOCATION_HISTORY,
  REVIEW_HISTORY,
  SHIFT_HISTORY,
  TRANSFER_HISTORY,
  captureBootstrap,
  captureHandle,
  historyChange,
} from "./support/lifecycle-contract-fixtures.ts";

function assertCanonicalLabHistory() {
  // Observe every valid kind on the old decoder, rather than stopping at the first rejection.
  const observed = LAB_HISTORY.map((entry) => {
    try {
      return readHistoryEntry(entry).kind;
    } catch (error) {
      if (!(error instanceof CourierContractError)) throw error;
      return `rejected:${entry.kind}:${error.boundary}`;
    }
  });
  assert.deepEqual(
    observed,
    LAB_HISTORY.map((entry) => entry.kind),
  );
  for (const entry of LAB_HISTORY) {
    const parsed = readHistoryEntry(entry);
    assert.ok("reading_id" in parsed);
    assert.equal(parsed.reading_id, ID.point);
    assert.equal(parsed.source_event_id, ID.source);
    assert.equal(parsed.author_id, ID.actor);
    assert.equal(parsed.source_device_time, LAB_RECEIPT.source_device_time);
    assert.equal(parsed.source_server_received_at, LAB_RECEIPT.source_server_received_at);
    assert.equal(parsed.recorded_at, LAB_RECEIPT.recorded_at);
    const change = readHistoryChange(historyChange(entry));
    assert.equal(change.resource_type, `history.${entry.kind}`);
    assert.equal(change.resource_id, entry.id);
    assert.equal(change.data.kind, entry.kind);
  }
  assertLabAlternatives();
  assertMalformedLabHistory();
}
function assertCanonicalHistory6() {
  const entries = [COMMUNITY_HISTORY, ...SUPPLY_HISTORY];
  const observed = entries.map((entry) => {
    try {
      return readHistoryEntry(entry).kind;
    } catch (error) {
      if (!(error instanceof CourierContractError)) throw error;
      return `rejected:${entry.kind}:${error.boundary}`;
    }
  });
  assert.deepEqual(
    observed,
    entries.map((entry) => entry.kind),
  );
  for (const entry of entries) {
    const change = readHistoryChange(historyChange(entry));
    assert.equal(change.resource_type, `history.${entry.kind}`);
    assert.equal(change.resource_id, entry.id);
    assert.equal(change.data.kind, entry.kind);
  }
  assertNewHistoryBoundaries();
}
function assertNewHistoryBoundaries() {
  const plan = SUPPLY_HISTORY[0];
  assert.ok(plan);
  for (const entry of [COMMUNITY_HISTORY, plan]) {
    for (const field of Object.keys(entry)) {
      const missing = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== field));
      assert.throws(() => readHistoryEntry(missing), `missing required ${entry.kind}.${field}`);
    }
  }
  assert.doesNotThrow(() =>
    readHistoryEntry({
      ...COMMUNITY_HISTORY,
      revision: 2,
      is_voided: true,
      command_id: ID.source,
      attendance: Number.MAX_SAFE_INTEGER,
    }),
  );
  assert.doesNotThrow(() =>
    readHistoryEntry({
      ...COMMUNITY_HISTORY,
      type_snapshot: { ...COMMUNITY_HISTORY.type_snapshot, id: COMMUNITY_HISTORY.type_id },
    }),
  );
  for (const mutation of [
    { attendance: -1 },
    { attendance: true },
    { attendance: Number.MAX_SAFE_INTEGER + 1 },
    { activity_id: ID.actor },
    { source_event_id: ID.source },
    { command_id: ID.source },
    { revision: 3 },
    { is_voided: true },
    { type_snapshot: null },
  ])
    assert.throws(() => readHistoryEntry({ ...COMMUNITY_HISTORY, ...mutation }));
  for (const mutation of [
    { source_kind: "receipt" },
    { assignment_id: null },
    { source_status: "accepted" },
    { source_event_id: ID.source },
    { source_kind: "future" },
  ])
    assert.throws(() => readHistoryEntry({ ...SUPPLY_HISTORY[0], ...mutation }));
  assert.throws(
    () => readHistoryChange({ ...historyChange(COMMUNITY_HISTORY), resource_id: ID.actor }),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
  );
}
function assertLabAlternatives() {
  const alternatives = [
    { ...LAB_RECEIPT, bag_id: ID.point },
    { ...LAB_DISCREPANCY, incident_id: ID.actor, configuration_pending: false },
    { ...LAB_COUNT, viability_percent: null, method_version_id: null },
    { ...LAB_COUNT, viability_percent: null, method_version_id: ID.actor },
    { ...LAB_COUNT, viability_percent: "100.000000", value: Number.MAX_SAFE_INTEGER },
    { ...LAB_COUNT, viability_percent: "-0.000000" },
    ...["not_requested", "awaiting_independent_qa", "superseded"].map((qa_state) => ({
      ...LAB_COUNT,
      qa_state,
      voided: true,
    })),
    { ...LAB_REJECTION, voided: false },
    { ...LAB_VOID, count_id: null, rejection_id: ID.history },
    { ...LAB_VOID, count_id: ID.history }, // Different table identities may share a UUID value.
  ];
  for (const entry of alternatives) assert.doesNotThrow(() => readHistoryEntry(entry));
  const count = readHistoryEntry(LAB_COUNT);
  assert.ok(count.kind === "lab_count");
  assert.equal(count.value, 0);
  assert.equal(count.viability_percent, "0.000000");
  assert.equal(count.method_version_id, ID.actor);
}
function assertMalformedLabHistory() {
  for (const field of Object.keys(LAB_RECEIPT)) {
    const missing = Object.fromEntries<unknown>(
      Object.entries(LAB_RECEIPT).filter(([key]) => key !== field),
    );
    assert.throws(() => readHistoryEntry(missing), `missing required ${field}`);
  }
  for (const mutation of [
    { reading_id: "bad" },
    { source_event_id: null },
    { author_id: "bad" },
    { bag_id: "bad" },
    { recorded_at: "2026-11-07T09:00:00" },
    { source_device_time: null },
    { source_server_received_at: "bad" },
    { subjects: [] },
    { subjects: [{ center_id: "bad", quadrant_id: null }] },
    { qa_state: "approved" },
    { voided: 0 },
    { configuration_pending: null },
    { reason: false },
    { kind: "lab_future" },
  ])
    assert.throws(() => readHistoryEntry({ ...LAB_RECEIPT, ...mutation }));
  for (const entry of [
    { ...LAB_RECEIPT, value: 0 },
    { ...LAB_RECEIPT, voided: true },
    { ...LAB_DISCREPANCY, configuration_pending: false },
    { ...LAB_DISCREPANCY, incident_id: ID.actor },
    { ...LAB_DISCREPANCY, reason: null },
    { ...LAB_COUNT, count_id: ID.actor },
    { ...LAB_COUNT, rejection_id: ID.actor },
    { ...LAB_COUNT, method_version_id: null },
    { ...LAB_COUNT, method_version_id: "bad" },
    { ...LAB_COUNT, value: null },
    { ...LAB_COUNT, value: true },
    { ...LAB_COUNT, value: -1 },
    { ...LAB_COUNT, value: 1.5 },
    { ...LAB_COUNT, value: Number.MAX_SAFE_INTEGER + 1 },
    ...["NaN", "Infinity", "1e1", "100.000001", "-0.000001", "0.1234567"].map(
      (viability_percent) => ({ ...LAB_COUNT, viability_percent }),
    ),
    { ...LAB_REJECTION, method_version_id: null },
    { ...LAB_REJECTION, rejection_id: ID.actor },
    { ...LAB_REJECTION, count_id: ID.actor },
    { ...LAB_REJECTION, reason: null },
    { ...LAB_VOID, count_id: null },
    { ...LAB_VOID, rejection_id: ID.actor },
    { ...LAB_VOID, voided: false },
    { ...LAB_VOID, value: 0 },
  ])
    assert.throws(() => readHistoryEntry(entry));
  assert.throws(
    () => readHistoryChange(historyChange({ ...LAB_COUNT, value: -1 })),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "body",
  );
  assert.throws(
    () =>
      readHistoryChange({
        ...historyChange(LAB_COUNT),
        resource_id: ID.actor,
        data: { ...LAB_COUNT, value: -1 },
      }),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
  );
  assert.throws(
    () => readHistoryChange({ ...historyChange(LAB_COUNT), resource_type: "history.lab_future" }),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
  );
}

void test("C1: canonical history6 preserves signed transfer event/source facts without inventing review, shift or lifecycle state", () => {
  assertCanonicalLabHistory();
  assertCanonicalHistory6();
  for (const phase of ["dispatch", "receive"] as const) {
    const body = {
      ...TRANSFER_HISTORY,
      phase,
      voided_at: phase === "receive" ? "2026-11-06T21:30:00Z" : null,
    };
    const parsed = readHistoryEntry(body);
    assert.ok(parsed.kind === "transfer_custody");
    assert.equal(parsed.id, ID.history);
    assert.equal(parsed.transfer_id, ID.point);
    assert.notEqual(parsed.id, parsed.transfer_id);
    assert.equal(parsed.source_event_id, ID.source);
    assert.equal(parsed.phase, phase);
    assert.equal(parsed.revision, 3);
    assert.equal(parsed.manifest_hash, "a".repeat(64));
    assert.equal(parsed.source_status, "in_review");
    assert.equal(parsed.source_code, "causal_parent_pending");
    assert.equal(parsed.voided_at, phase === "receive" ? "2026-11-06T21:30:00Z" : null);
    assert.deepEqual(parsed.subjects, [
      { center_id: ID.center, quadrant_id: null },
      { center_id: ID.otherCenter, quadrant_id: ID.otherQuadrant },
    ]);
    assert.equal("review_item_id" in parsed, false);
    assert.equal("shift_id" in parsed, false);
    assert.equal("proposal_event_id" in parsed, false);
    const change = readHistoryChange(historyChange(body));
    assert.equal(change.resource_type, "history.transfer_custody");
    assert.equal(change.resource_id, ID.history);
    assert.equal(change.resource_version, "opaque:publication-v2");
    assert.equal(change.sequence, 8);
    assert.equal(change.data.kind, "transfer_custody");
  }
  for (const mutation of [
    { transfer_id: "not-a-uuid" },
    { phase: "prepared" },
    { phase: "resolution" },
    { revision: 0 },
    { manifest_hash: "" },
    { source_status: null },
    { subjects: [] },
    { voided_at: "2026-11-06T21:30:00" },
  ]) {
    assert.throws(
      () => readHistoryChange(historyChange({ ...TRANSFER_HISTORY, ...mutation })),
      (error: unknown) => error instanceof CourierContractError && error.boundary === "body",
    );
  }
  assert.throws(
    () =>
      readHistoryChange({
        ...historyChange(TRANSFER_HISTORY),
        data: { ...TRANSFER_HISTORY, id: ID.actor, transfer_id: "not-a-uuid" },
      }),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
  );
  assert.throws(
    () =>
      readHistoryChange({
        ...historyChange(TRANSFER_HISTORY),
        data: { ...TRANSFER_HISTORY, kind: "relocation_proposal", transfer_id: "not-a-uuid" },
      }),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
  );
});

void test("C1: history retains original ingest, actual reviewed effects and noncurrent shift approval separately", () => {
  const reviewed = readHistoryEntry(REVIEW_HISTORY);
  assert.ok(reviewed.kind === "review_decision");
  assert.equal(reviewed.source_event_id, "00000000-0000-4000-8000-000000000002");
  assert.equal(reviewed.source_status, "in_review");
  assert.equal(reviewed.source_code, "clock_skew");
  assert.equal(reviewed.effect_state, "applied_review");
  assert.equal(reviewed.is_terminal, true);
  assert.equal(reviewed.revision, 2);
  assert.equal(reviewed.approval_current, null);
  const adopted = readHistoryEntry({ ...REVIEW_HISTORY, effect_state: "adopted_legacy" });
  assert.ok(adopted.kind === "review_decision");
  assert.equal(adopted.effect_state, "adopted_legacy");
  const incident = readHistoryEntry({
    ...REVIEW_HISTORY,
    decision_kind: "open_incident",
    is_terminal: false,
    decision_state: "pending",
    effect_state: "incident_open",
    incident_id: ID.point,
  });
  assert.ok(incident.kind === "review_decision");
  assert.equal(incident.is_terminal, false);
  assert.equal(incident.incident_id, ID.point);
  const shift = readHistoryEntry(SHIFT_HISTORY);
  assert.ok(shift.kind === "shift_validation");
  assert.equal(shift.review_item_id, null);
  assert.equal(shift.shift_id, ID.point);
  assert.equal(shift.is_terminal, null);
  assert.equal(shift.approval_current, false);
  assert.equal(shift.decision_kind, "approve");
});
void test("C1: relocation preserves pending/terminal identity, nullable legacy audit, actual task and source void", () => {
  const pending = readHistoryEntry(RELOCATION_HISTORY);
  assert.ok(pending.kind === "relocation_proposal");
  assert.equal(pending.decision, null);
  assert.equal(pending.proposal_event_id, ID.source);
  assert.deepEqual(pending.proposed_location, [-99.99, 20.005]);
  for (const status of ["approved", "rejected"] as const) {
    const terminal = readHistoryEntry({
      ...RELOCATION_HISTORY,
      status,
      decision: {
        id: ID.actor,
        decision: status,
        reason: null,
        decided_at: null,
        published_point_version: null,
      },
      next_day_task: { id: ID.device, code: "T-138", due_date: "2026-11-07" },
      source_voided_at: "2026-11-06T21:00:00+00:00",
    });
    assert.ok(terminal.kind === "relocation_proposal");
    assert.ok(terminal.decision !== null && terminal.next_day_task !== null);
    assert.equal(terminal.decision.decision, status);
    assert.equal(terminal.decision.reason, null);
    assert.equal(terminal.decision.decided_at, null);
    assert.equal(terminal.decision.published_point_version, null);
    assert.equal(terminal.next_day_task.id, ID.device);
    assert.equal(terminal.next_day_task.due_date, "2026-11-07");
    assert.equal(terminal.source_voided_at, "2026-11-06T21:00:00+00:00");
  }
  const legacy: Record<string, unknown> = { ...RELOCATION_HISTORY };
  delete legacy.next_day_task;
  const decoded = readHistoryEntry(legacy);
  assert.ok(decoded.kind === "relocation_proposal");
  assert.equal(decoded.next_day_task, null);
  assert.equal("review_item_id" in decoded, false);
});
void test("C1: history changes reject unknown kinds or bad identities before a consumer can advance its cursor", () => {
  const parsed = readHistoryChange(historyChange(RELOCATION_HISTORY));
  assert.equal(parsed.resource_type, "history.relocation_proposal");
  assert.equal(parsed.sequence, 8);
  assert.equal(parsed.resource_version, "opaque:publication-v2");
  for (const data of [
    { ...RELOCATION_HISTORY, id: ID.actor, proposal_event_id: "not-a-uuid" },
    { ...RELOCATION_HISTORY, kind: "review_decision", proposal_event_id: "not-a-uuid" },
    { ...RELOCATION_HISTORY, kind: "invented_history", proposal_event_id: "not-a-uuid" },
  ]) {
    assert.throws(
      () => readHistoryChange({ ...historyChange(RELOCATION_HISTORY), data }),
      (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
    );
  }
  for (const mutation of [
    { resource_type: "history.review_decision" },
    { resource_id: ID.actor },
    { sequence: 0 },
    { sequence: 1.5 },
    { resource_version: "" },
    { action: "remove" },
    { data: { ...RELOCATION_HISTORY, kind: "invented_history" } },
  ]) {
    assert.throws(
      () => readHistoryChange({ ...historyChange(RELOCATION_HISTORY), ...mutation }),
      (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
    );
  }
  for (const mutation of [
    { subjects: [] },
    { proposal_event_id: "not-a-uuid" },
    { proposed_location: [181, 20] },
    { source_voided_at: "2026-11-06T21:00:00" },
  ]) {
    assert.throws(() => readHistoryEntry({ ...RELOCATION_HISTORY, ...mutation }));
    assert.throws(
      () => readHistoryChange(historyChange({ ...RELOCATION_HISTORY, ...mutation })),
      (error: unknown) => error instanceof CourierContractError && error.boundary === "body",
    );
  }
  assert.throws(
    () => readHistoryChange({ ...historyChange(RELOCATION_HISTORY), data: null }),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "body",
  );
  assert.throws(() => readHistoryEntry(historyChange()));
  assert.throws(() => readHistoryChange(REVIEW_HISTORY));
  for (const malformed of [null, [], {}]) {
    assert.throws(
      () => readHistoryChange(malformed),
      (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
    );
  }
});
void test("C2: quadrant legacy closure is unknown, blocks remain blocks and current epochs require coherent closure", () => {
  assert.equal(readQuadrantReference(QUADRANT_REFERENCE).closure.kind, "unknown");
  const block = { ...QUADRANT_REFERENCE, resource_type: "block", id: ID.point };
  assert.equal(readQuadrantReference(block).closure.kind, "not_applicable");
  const closed = readQuadrantReference({
    ...QUADRANT_REFERENCE,
    is_closed: true,
    closure_id: ID.history,
  });
  assert.equal(closed.reference.revision, 3);
  assert.deepEqual(closed.closure, { kind: "closed", id: ID.history });
  assert.equal(
    readQuadrantReference({ ...QUADRANT_REFERENCE, is_closed: false, closure_id: null }).closure
      .kind,
    "open",
  );
  for (const mutation of [
    { is_closed: false },
    { closure_id: null },
    { is_closed: true, closure_id: null },
    { is_closed: false, closure_id: ID.history },
    { revision: 0 },
    { id: ID.actor },
  ]) {
    assert.throws(() => readQuadrantReference({ ...QUADRANT_REFERENCE, ...mutation }));
  }
  assert.throws(() => readQuadrantReference({ ...block, is_closed: false, closure_id: null }));
  const change = {
    sequence: 9,
    action: "upsert",
    resource_type: "quadrant",
    resource_id: ID.quadrant,
    resource_version: "epoch-is-not-this-hash",
    data: QUADRANT_REFERENCE,
  };
  for (const data of [
    { ...QUADRANT_REFERENCE, id: ID.actor, revision: 0 },
    { ...QUADRANT_REFERENCE, resource_type: "block", revision: 0 },
    { ...QUADRANT_REFERENCE, resource_type: "invented_reference", revision: 0 },
  ]) {
    assert.throws(
      () => readQuadrantChange({ ...change, data }),
      (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
    );
  }
  for (const data of [null, { ...QUADRANT_REFERENCE, revision: 0 }]) {
    assert.throws(
      () => readQuadrantChange({ ...change, data }),
      (error: unknown) => error instanceof CourierContractError && error.boundary === "body",
    );
  }
  const parsed = readQuadrantChange(change);
  assert.equal(parsed.resource_version, "epoch-is-not-this-hash");
  assert.equal(parsed.data.revision, 3);
  assert.throws(() => readQuadrantChange({ ...change, resource_type: "block" }));
  assert.throws(() => readQuadrantChange({ ...change, resource_id: ID.actor }));
  assert.throws(() => readQuadrantChange({ ...change, resource_version: "" }));
  assert.throws(
    () => readQuadrantChange(null),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "envelope",
  );
  assert.throws(
    () =>
      readQuadrantChange({
        ...change,
        data: { ...QUADRANT_REFERENCE, is_closed: true, closure_id: null },
      }),
    (error: unknown) => error instanceof CourierContractError && error.boundary === "body",
  );
});
void test("capture context preserves whole SYNC pairs, known denial and the proven local owner/session revision", () => {
  const observed = readCaptureContext({
    source: "bootstrap",
    body: captureBootstrap(),
    handle: captureHandle(),
  });
  assert.ok(observed.state === "observed");
  assert.deepEqual(
    observed.context.grants.map((pair) => [pair.centers.ids, pair.quadrants.ids]),
    [
      [[ID.center], [ID.otherQuadrant]],
      [[ID.otherCenter], [ID.quadrant]],
    ],
  );
  assert.equal(observed.binding.owner.userId, ID.actor);
  assert.equal(observed.binding.sessionId, "retained-test-session");
  assert.equal(observed.binding.revision, 7);
  const denied = readCaptureContext({
    source: "bootstrap",
    body: captureBootstrap({ ...CAPTURE_CONTEXT, grants: [] }),
    handle: captureHandle(),
  });
  assert.ok(denied.state === "observed");
  assert.equal(denied.context.grants.length, 0);
  const repeated = readCaptureContext({
    source: "bootstrap",
    body: captureBootstrap({
      ...CAPTURE_CONTEXT,
      grants: [...CAPTURE_CONTEXT.grants, ...CAPTURE_CONTEXT.grants],
    }),
    handle: captureHandle(),
  });
  assert.ok(repeated.state === "observed");
  assert.equal(repeated.context.grants.length, 4); // Contributing profiles may repeat whole pairs.
  for (const context of [
    undefined,
    null,
    { ...CAPTURE_CONTEXT, schema_version: 2 },
    { ...CAPTURE_CONTEXT, permission: "field.bootstrap" },
    {
      ...CAPTURE_CONTEXT,
      grants: [{ centers: { mode: "all", ids: [ID.center] }, quadrants: { mode: "all", ids: [] } }],
    },
    {
      ...CAPTURE_CONTEXT,
      grants: [
        {
          centers: { mode: "selected", ids: [ID.center, ID.center] },
          quadrants: { mode: "all", ids: [] },
        },
      ],
    },
  ]) {
    assert.equal(
      readCaptureContext({
        source: "bootstrap",
        body: { ...captureBootstrap(), capture_context: context },
        handle: captureHandle(),
      }).state,
      "unavailable",
    );
  }
});
void test("capture metadata cannot hydrate initial changes, adopt another owner or renew final/stale session authority", () => {
  const handle = captureHandle();
  for (const context of [
    { ...CAPTURE_CONTEXT, user_id: ID.point },
    { ...CAPTURE_CONTEXT, organization_id: ID.point },
    { ...CAPTURE_CONTEXT, scope_revision: "b".repeat(64) },
  ]) {
    assert.equal(
      readCaptureContext({ source: "bootstrap", body: captureBootstrap(context), handle }).state,
      "unavailable",
    );
  }
  assert.equal(
    readCaptureContext({ source: "bootstrap", body: captureBootstrap(), handle: null }).state,
    "unavailable",
  );
  assert.equal(
    readCaptureContext({
      source: "bootstrap",
      body: captureBootstrap(),
      handle: { ...handle, isCurrent: () => false },
    }).state,
    "unavailable",
  );
  const changes = { cursor: null, capture_context: CAPTURE_CONTEXT };
  const current = readCaptureContext({ source: "changes", body: changes, handle });
  assert.equal(current.state, "observed"); // Normal null wire cursor is NOT final/no-pull.
  const initial = readCaptureContext({
    source: "changes",
    body: changes,
    handle: { ...handle, scopeRevision: null },
  });
  assert.equal(initial.state, "unavailable");
  assert.equal(
    readCaptureContext({ source: "changes", body: { capture_context: null }, handle }).state,
    "unavailable",
  );
  assert.equal(
    readCaptureContext({
      source: "changes",
      body: { capture_context: { ...CAPTURE_CONTEXT, scope_revision: "b".repeat(64) } },
      handle,
    }).state,
    "unavailable",
  );
  assert.equal(
    readCaptureContext({ source: "no-pull", body: { capture_context: null }, handle }).state,
    "no-observation",
  );
  assert.equal(readCaptureContext({ source: "final", body: changes, handle }).state, "unavailable");
});
