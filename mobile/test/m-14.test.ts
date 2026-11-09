import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { EvidenceSession } from "../src/attachments/evidence-session.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { KvStore } from "../src/db/kv-store.ts";
import { accepted, answer, scriptedTransport } from "./support/scripted-transport.ts";
import { historyChangeStatements } from "../src/features/ovitrap-lifecycle/history-projections.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShiftCloseService } from "../src/features/shift-close/service.ts";
import { applyClosePatch, closeDeliveryKey, supplyDifference } from "../src/features/shift-close/domain.ts";
import { openTestDatabase, createTestDatabase } from "./support/sqlite-executor.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { makeEnvelope, FIXED_NOW } from "./support/factories.ts";
import type { SqlExecutor } from "../src/db/sql.ts";
import { ShiftLocationSource } from "../src/features/shift-close/location.ts";
import type { LocationState } from "../src/features/day/location.ts";
import { reconciliationEvents } from "../src/features/shift-close/reconciliation.ts";
import { readSupplySource, supplyBundleStatements } from "../src/features/shift-close/supplies.ts";
import { toOutboxEvent } from "../src/outbox/outbox-event.ts";

const SHIFT = "10000000-0000-4000-8000-000000000001";
const OWNER = "synthetic-owner";
async function fixture(db: SqlExecutor) {
  const outbox = new OutboxRepository(db, () => FIXED_NOW);
  const opening = makeEnvelope({ type: "shift.open", shift_id: SHIFT, payload: { odometer_km: 100 } });
  await outbox.enqueue(opening);
  return { outbox, service: serviceFor(db) };
}
function serviceFor(db: SqlExecutor) {
  let sequence = 10;
  return new ShiftCloseService({
    db, now: () => FIXED_NOW,
    uuid: () => `20000000-0000-4000-8000-${String(++sequence).padStart(12,"0")}`,
    identity: () => OWNER,
    pending: () => Promise.resolve([{ taskId: "task-one", pointCode: "OV-001" }]),
    serialize: (write) => write(),
    notify: () => undefined,
  });
}
void test("AC1: nonzero supply differences remain explicit and never prevent local close", async () => {
  assert.equal(supplyDifference({ credited: "10.000001", used: "2", returned: "7", shrinkage: "0" }), "1.000001");
  assert.equal(supplyDifference({ credited: null, used: "0", returned: "0", shrinkage: "0" }), null);
  const db = await createTestDatabase();
  const { service } = await fixture(db);
  const retainedFrame = { assignment_line_id: SHIFT, plan_revision: 1, planned: "10", credited: "10", used: "2", returned: "7", shrinkage: "0", difference: "1", delivery_variance: "0" };
  await db.runAtomically(supplyBundleStatements({ supplies: [{ id: SHIFT, shift_id: SHIFT, date: "2026-01-15", origin_id: SHIFT, reconciliation: { revision: 1, frame: { lines: [retainedFrame] } }, receipts: [] }] }));
  await service.start();
  await service.update({ odometer: "99", dispositions: { "task-one": "leave_pending" } });
  const result = await service.close();
  assert.ok(result.draft?.locallyClosedAt);
  assert.equal(result.draft.odometer, "99");
  assert.deepEqual(result.draft.supplies[0]?.source.frame, [retainedFrame]);
  assert.deepEqual(result.draft.pending, [{ taskId: "task-one", pointCode: "OV-001" }]);
  assert.equal(result.draft.dispositions["task-one"], "leave_pending");
  assert.equal(closeDeliveryKey(result.events), "mobile.shiftClose.phoneClosed");
  await service.close();
  assert.equal((await db.query("SELECT id FROM outbox_event WHERE type='shift.close'")).length, 1);
});
void test("AC pending points and storage: explicit disposition required; failed commit never reports closed", async () => {
  const db = await createTestDatabase();
  const { service } = await fixture(db);
  await service.start();
  await service.update({ odometer: "110" });
  await assert.rejects(service.close(), /pending/i);
  await service.update({ dispositions: { "task-one": "leave_pending" } });
  const failing = serviceFor({ ...db, runAtomically: () => Promise.reject(new Error("Disk full")) });
  await assert.rejects(failing.close(), /Disk full/);
  assert.equal((await service.read()).draft?.locallyClosedAt, null);
  assert.equal((await db.query("SELECT id FROM outbox_event WHERE type='shift.close'")).length, 0);
});
void test("AC2/3: offline close survives cold SQLite reopen; retry keeps original UUID and observation never reopens", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wolbachia-m14-"));
  const path = join(directory, "phone.sqlite");
  let handle = await openTestDatabase(path);
  try {
    const { service } = await fixture(handle.executor);
    await service.start();
    await service.update({ odometer: "110", note: "Retained note", dispositions: { "task-one": "leave_pending" } });
    const saved = await service.close();
    const original = saved.events[0]?.envelope;
    assert.ok(original);
    handle.close();
    handle = await openTestDatabase(path);
    const restarted = serviceFor(handle.executor);
    const restored = await restarted.read();
    assert.equal(restored.draft?.note, "Retained note");
    assert.deepEqual(restored.events[0]?.envelope, original);
    const outbox = new OutboxRepository(handle.executor, () => FIXED_NOW);
    const claimed = await outbox.claimPending(10);
    const closing = claimed.find((event) => event.envelope.type === "shift.close");
    assert.equal(closing?.envelope.id, original.id);
    await outbox.recoverInterrupted();
    const retry = await outbox.claimPending(10);
    assert.deepEqual(retry.find((event) => event.envelope.id === original.id)?.envelope, original);
    await outbox.recoverInterrupted();
    const ids = (await handle.executor.query("SELECT id FROM outbox_event WHERE local_status='pending'")).map((row) => String(row.id));
    const script = scriptedTransport([answer(ids.map(accepted)), answer([])]);
    const deps = { outbox, kv: new KvStore(handle.executor), deviceId: SHIFT, now: () => FIXED_NOW, transport: script.transport };
    await runSyncPass(deps, { batchSize: 50 });
    await runSyncPass(deps, { batchSize: 50 });
    assert.equal(script.requests.flatMap((request) => request.events).filter((event) => event.id === original.id).length, 1);
    const history = { id: SHIFT, kind: "shift_validation", review_item_id: null, source_event_id: original.id, shift_id: SHIFT, decision_kind: "observe", revision: 1, is_terminal: null, decision_state: "observed", reason: "Check return at warehouse", decided_by: SHIFT, decided_at: FIXED_NOW.toISOString(), subjects: [{ center_id: SHIFT, quadrant_id: null }], source_status: "accepted", source_code: "accepted", effect_state: "observed", incident_id: null, declared_void_target_uuid: null, approval_current: null };
    await handle.executor.runAtomically(historyChangeStatements({ history: [{ sequence: 1, action: "upsert", resource_type: "history.shift_validation", resource_id: SHIFT, resource_version: "v1", data: history }] }));
    assert.equal((await restarted.read()).history[0]?.reason, "Check return at warehouse");
    assert.equal(closeDeliveryKey((await restarted.read()).events), "mobile.shiftClose.serverReceived");
    assert.ok((await restarted.read()).draft?.locallyClosedAt);
  } finally {
    handle.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
void test("AC truthful delivery: pending, error, rejected and review remain distinct from complete delivery", () => {
  const envelope = makeEnvelope({ type: "shift.close" });
  const event = toOutboxEvent({ ...envelope, payload: JSON.stringify(envelope.payload), seq: 1, manual_capture: 0, gps: null, local_status: "pending", attempts: 0, updated_at: FIXED_NOW.toISOString() });
  for (const status of ["pending", "sending", "error"] as const)
    assert.equal(closeDeliveryKey([{ ...event, status }]), "mobile.shiftClose.phoneClosed");
  assert.equal(closeDeliveryKey([{ ...event, status: "in_review" }]), "mobile.shiftClose.inReview");
  assert.equal(closeDeliveryKey([{ ...event, status: "rejected" }]), "mobile.shiftClose.rejected");
  assert.equal(closeDeliveryKey([]), "mobile.shiftClose.phoneClosed");
});

void test("AC1 reconciliation: actual receipt return precedes close in one atomic outbox commit", async () => {
  const db = await createTestDatabase();
  const { service } = await fixture(db);
  await db.runAtomically([{ sql: "INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body) VALUES('supply_assignment',?,'v1',0,?)", params: [SHIFT, JSON.stringify({ id: SHIFT, shiftId: SHIFT, originId: SHIFT, revision: 2, frame: [], receipts: [{ id: SHIFT, source_event_id: SHIFT, voided: false, lines: [{ id: SHIFT }] }] })] }]);
  const started = await service.start();
  const supply = started.draft?.supplies[0];
  assert.ok(supply);
  await service.update({ odometer: "110", dispositions: { "task-one": "leave_pending" }, supplies: [{ ...supply, returns: [{ receiptLineId: SHIFT, receiptSourceEventId: SHIFT, returned: "7.25" }] }] });
  const closed = await service.close();
  assert.deepEqual(closed.events.map((event) => event.envelope.type), ["supplies.reconcile", "shift.close"]);
  assert.ok(closed.events[0]!.envelope.device_time < closed.events[1]!.envelope.device_time);
  assert.deepEqual(closed.events[0]?.envelope.payload, { command_id: supply.eventId, assignment_id: SHIFT, expected_revision: 2, used: [], returned: [{ receipt_line_id: SHIFT, receipt_source_event_id: SHIFT, destination_id: SHIFT, quantity: "7.25" }], shrinkage: [] });
});

void test("AC2 location: local close stops a late native watcher; cold start refuses it and rejected close cannot resume capture", async () => {
  let resolveWatch!: (stop: () => void) => void;
  let publish!: (state: LocationState) => void;
  let isOpen = true;
  let stops = 0;
  const fixes: LocationState[] = [];
  const source = new ShiftLocationSource({ start: (listener) => { publish = listener; return new Promise((resolve) => { resolveWatch = resolve; }); } }, () => Promise.resolve(isOpen));
  const started = source.start((fix) => { fixes.push(fix); });
  await Promise.resolve();
  isOpen = false;
  source.stopAll();
  publish({ kind: "denied" });
  resolveWatch(() => { stops += 1; });
  await started;
  assert.equal(stops, 1);
  assert.deepEqual(fixes, []);
  await source.start(() => { throw new Error("Closed shift must not start"); });
  const db = await createTestDatabase();
  const { service, outbox } = await fixture(db);
  await service.start();
  await service.update({ odometer: "110", dispositions: { "task-one": "leave_pending" } });
  const state = await service.close();
  const closeId = state.draft!.closeEventId;
  await outbox.claimPending(10);
  await outbox.settle([{ id: closeId, action: "reject", result: { code: "shift_not_open", params: {} } }]);
  await assert.rejects(outbox.enqueue(makeEnvelope({ type: "location.ping", shift_id: SHIFT })));
  await assert.rejects(outbox.enqueue(makeEnvelope({ type: "ovitrap.check", shift_id: SHIFT })));
});
void test("AC auth: lost admission retains the recoverable draft without publishing close", async () => {
  const db = await createTestDatabase();
  await fixture(db);
  let admission: string | null = "first";
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  let hasPaused = false;
  const service = new ShiftCloseService({ db, now: () => FIXED_NOW, uuid: () => SHIFT, identity: () => OWNER, admission: () => admission,
    pending: () => Promise.resolve([]), serialize: async (write) => { if (hasPaused) await barrier; return write(); }, notify: () => undefined });
  await service.start(); await service.update({ odometer: "110" });
  hasPaused = true;
  const closing = service.close();
  admission = null; release();
  await assert.rejects(closing, /admission/i);
  assert.equal((await service.read()).draft?.locallyClosedAt, null);
  assert.equal((await db.query("SELECT id FROM outbox_event WHERE type='shift.close'")).length, 0);
});
void test("AC1 source projection: received zero and missing receipt differ; malformed supply page cannot commit", async () => {
  const db = await createTestDatabase();
  const frame = { assignment_line_id: SHIFT, plan_revision: 1, planned: "10", credited: "0", used: "0", returned: "0", shrinkage: "0", difference: "0", delivery_variance: "10" };
  const body = { supplies: [{ id: SHIFT, shift_id: SHIFT, date: "2026-01-15", origin_id: SHIFT, reconciliation: { revision: 1, frame: { lines: [frame] } }, receipts: [] }] };
  await db.runAtomically(supplyBundleStatements(body));
  const { service } = await fixture(db);
  const started = await service.start();
  assert.equal(started.draft?.supplies[0]?.source.frame[0]?.credited, "0");
  assert.throws(() => supplyBundleStatements({ supplies: [{ ...body.supplies[0], receipts: null }] }), /supply collection/i);
});

void test("AC evidence dependency: an unverified nested shrinkage photo holds both reconcile and close", async () => {
  const db = await createTestDatabase();
  const { service, outbox } = await fixture(db);
  const store = new AttachmentStore(db);
  const owner = { issuer: "https://api.example.test", organizationId: SHIFT, userId: SHIFT, deviceId: SHIFT };
  const session = new EvidenceSession({ store, current: () => ({ owner, sessionId: "test-session" }), isFinal: () => false });
  const fence = await session.capture();
  const reconcile = makeEnvelope({ type: "supplies.reconcile", shift_id: SHIFT, payload: { shrinkage: [{ evidence_ids: [SHIFT] }] } });
  await store.reserve({ id: SHIFT, draftId: reconcile.id, fence });
  await store.saveOwned({ id: SHIFT, fileRef: "private-test-photo", contentType: "image/png", sizeBytes: 1, sha256: "synthetic-hash" }, fence);
  await outbox.enqueue(reconcile, store.bindingStatements({ eventId: reconcile.id, evidenceIds: [SHIFT], fence }));
  await service.start(); await service.update({ odometer: "110", dispositions: { "task-one": "leave_pending" } });
  const closed = await service.close();
  const selected = await outbox.claimPending(50, { fence, isFinal: false });
  assert.ok(!selected.some((event) => event.envelope.type === "shift.close" || event.envelope.type === "supplies.reconcile"));
  assert.equal(closeDeliveryKey(closed.events), "mobile.shiftClose.phoneClosed");
  assert.equal(await store.saveProgress({ id: SHIFT, fence, state: "verified", verifiedAt: FIXED_NOW.toISOString(), attemptVersion: 0 }), true);
  const released = await outbox.claimPending(50, { fence, isFinal: false });
  assert.deepEqual(released.map((event) => event.envelope.type), ["supplies.reconcile", "shift.close"]);
  await outbox.settle([{ id: reconcile.id, action: "failTransient", retryAt: "2026-01-15T12:01:00.000Z" }, { id: closed.draft!.closeEventId, action: "release" }]);
  assert.deepEqual(await outbox.claimPending(50, { fence, isFinal: false }), []);
  assert.equal(await outbox.nextRetryDelayMs({ fence, isFinal: false }), 60_000);
});
void test("AC atomicity: a concurrent draft edit rolls back the entire stale close", async () => {
  const db = await createTestDatabase();
  const { service } = await fixture(db);
  await service.start(); await service.update({ odometer: "110", dispositions: { "task-one": "leave_pending" } });
  let hasInjected = false;
  const stale = serviceFor({ ...db, runAtomically: async (statements) => {
    if (!hasInjected && statements[0]?.sql.startsWith("INSERT INTO outbox_event")) { hasInjected = true; await service.update({ note: "Newer retained input" }); }
    await db.runAtomically(statements);
  } });
  await assert.rejects(stale.close());
  assert.equal((await service.read()).draft?.note, "Newer retained input");
  assert.equal((await service.read()).draft?.locallyClosedAt, null);
  assert.equal((await db.query("SELECT id FROM outbox_event WHERE type='shift.close'")).length, 0);
});

void test("AC evidence retention: a stale form edit cannot erase an already adopted photo", async () => {
  const db = await createTestDatabase();
  const { service } = await fixture(db);
  const state = await service.start();
  assert.ok(state.draft);
  const supply = { eventId: SHIFT, source: { id: SHIFT, date: "2026-01-15", shiftId: SHIFT, originId: SHIFT, revision: 1, frame: [], receipts: [] }, returns: [], photos: [{ id: SHIFT, fileRef: "retained-private-photo" }] };
  const saved = { ...state.draft, supplies: [supply] };
  const updated = applyClosePatch(saved, { supplies: [{ ...supply, photos: [] }] });
  assert.deepEqual(updated.supplies[0]?.photos, supply.photos);
});

void test("AC1 shrinkage: real receipt and photo references are retained; Other without text cannot close", async () => {
  const db = await createTestDatabase();
  const { service } = await fixture(db);
  const state = await service.start();
  assert.ok(state.draft);
  const source = readSupplySource({ id: SHIFT, shift_id: SHIFT, date: "2026-01-15", origin_id: SHIFT, reconciliation: { revision: 2, frame: null }, receipts: [{ id: SHIFT, event_id: SHIFT, source_event_id: SHIFT, release_id: SHIFT, signature_upload_id: SHIFT, voided: false, lines: [{ id: SHIFT, release_line_id: SHIFT, quantity: "10" }] }] });
  const loss = { receiptLineId: SHIFT, receiptSourceEventId: SHIFT, quantity: "1", reasonCode: "other", reason: "Retained damage explanation" };
  const supply = { eventId: SHIFT, source, returns: [], photos: [{ id: SHIFT, fileRef: "retained-private-file" }], shrinkage: [loss] };
  const draft = { ...state.draft, supplies: [supply] };
  const closing = makeEnvelope({ type: "shift.close", device_time: FIXED_NOW.toISOString() });
  const [event] = reconciliationEvents(draft, closing);
  assert.deepEqual(event?.payload.shrinkage, [{ receipt_line_id: SHIFT, receipt_source_event_id: SHIFT, quantity: "1", reason_code: "other", reason: loss.reason, evidence_ids: [SHIFT] }]);
  assert.throws(() => reconciliationEvents({ ...draft, supplies: [{ ...supply, shrinkage: [{ ...loss, reason: "" }] }] }, closing), /reason/i);
});
