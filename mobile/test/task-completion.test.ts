import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import type { BundleResult } from "../src/features/day/bundle-service.ts";
import { parseAssignment } from "../src/features/day/assignment-parser.ts";
import { buildDay, mapTasks } from "../src/features/day/domain.ts";
import { markerState } from "../src/features/day/presentation.ts";
import { OutboxWorkOverlay } from "../src/features/day/local-work.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { captureEvent } from "../src/features/ovitrap-check/events.ts";
import type { Draft } from "../src/features/ovitrap-check/types.ts";
import { KvStore } from "../src/db/kv-store.ts";
import { migrate } from "../src/db/migrations.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import type { SyncCallResult } from "../src/sync/sync-transport.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { createStores, FIXED_NOW, FIXED_DEVICE_ID, makeEnvelope } from "./support/factories.ts";
import type { TestStores } from "./support/factories.ts";
import { makeDraft, POINT } from "./support/m-08-fixtures.ts";
import {
  accepted,
  answer,
  failure,
  httpFailure,
  scriptedTransport,
} from "./support/scripted-transport.ts";

const TASK_ID = "10000000-0000-4000-8000-000000000001";
const QUADRANT_ID = "20000000-0000-4000-8000-000000000001";
function task(patch: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    kind: "task",
    code: "OV-1:check:2026-01-15",
    point: POINT.id,
    quadrant_id: QUADRANT_ID,
    courier: "30000000-0000-4000-8000-000000000001",
    revision: 7,
    action: "check",
    date: "2026-01-15",
    category: "high",
    source: null,
    protocol: null,
    target: 40,
    is_completed: false,
    ...patch,
  };
}
function bundle(assignments: readonly unknown[] = [task()]) {
  return {
    bundle_version: "stable-v3-etag",
    schema_version: "assignments-v3",
    scope_revision: "scope-1",
    cursor: "signed-opaque-cursor",
    next_change_at: null,
    map_manifest_ready: false,
    assignments,
    map_manifests: [],
    sampling_points: [
      {
        id: POINT.id,
        code: POINT.code,
        block_id: "40000000-0000-4000-8000-000000000001",
        quadrant_id: QUADRANT_ID,
        location: [-99, 19],
        is_retired: false,
        version: 1,
      },
    ],
  };
}
function change(sequence: number, data: Record<string, unknown>) {
  return {
    sequence,
    action: "upsert" as const,
    resource_type: "task",
    resource_id: TASK_ID,
    resource_version: createHash("sha256")
      .update(JSON.stringify(data, Object.keys(data).sort()))
      .digest("hex"),
    data,
  };
}
async function day(local: TestStores) {
  const cache = await new DayStore(local.db).read();
  return buildDay({
    tasks: cache.tasks,
    work: await new OutboxWorkOverlay(local.db).read(),
    location: { kind: "unavailable" },
    now: FIXED_NOW,
  });
}
async function saveCapture(
  local: TestStores,
  draft = makeDraft({ deviceTime: "2026-01-16T01:00:00.000Z" }),
) {
  const store = new OvitrapStore(local.db);
  await store.begin(draft);
  const event = captureEvent(draft);
  assert.equal(Object.hasOwn(event.payload, "task_id"), false);
  await local.outbox.enqueue(event, store.commitStatements(draft));
  return event;
}
async function accept(local: TestStores, id: string) {
  await local.outbox.claimPending(50);
  await local.outbox.settle([{ id, action: "accept", result: { code: "accepted", params: {} } }]);
}
function events(local: TestStores) {
  return local.db.query("SELECT id,local_status FROM outbox_event ORDER BY seq");
}

void test("v3 completion is strict and legacy absence remains unknown", async () => {
  const local = await createStores();
  const store = new DayStore(local.db);
  for (const value of [true, false]) {
    assert.equal(parseAssignment(task({ is_completed: value }))?.isCompleted, value);
    await store.replace(bundle([task({ is_completed: value })]), FIXED_NOW);
    assert.equal((await day(local)).completed, Number(value));
  }
  const legacy = task();
  Reflect.deleteProperty(legacy, "is_completed");
  assert.equal(parseAssignment(legacy)?.isCompleted, undefined);
  await store.replace(bundle([legacy]), FIXED_NOW);
  const unknown = (await day(local)).tasks[0];
  assert.ok(unknown);
  assert.equal(unknown.completion, "unknown");
  assert.equal(markerState(unknown).key, "mobile.day.unknownStatus");
  for (const invalid of [null, "true", 0, [], {}])
    assert.equal(parseAssignment(task({ is_completed: invalid })), null);
  await store.replace(bundle([task({ is_completed: "false" })]), FIXED_NOW);
  assert.equal((await store.read()).meta?.unreadable_rows, 1);
});

void test("current same-owner completion reopens despite retained context and old receipt", async () => {
  const local = await createStores();
  const store = new DayStore(local.db);
  await store.replace(bundle([task({ is_completed: true })]), FIXED_NOW);
  const received = makeEnvelope({ payload: { task_id: TASK_ID } });
  await local.outbox.enqueue(received);
  await accept(local, received.id);
  const pending = makeEnvelope({ payload: { task_id: TASK_ID } });
  await local.outbox.enqueue(pending);
  await store.applyChanges({ assignments: [change(10, task({ is_completed: true }))] });
  assert.equal((await day(local)).completed, 1);
  await store.applyChanges({ assignments: [change(11, task())] });
  const cached = (await store.read()).tasks[0];
  assert.equal(cached?.isKept, true);
  assert.equal(cached.task.isCompleted, true);
  assert.equal(cached.serverCompletion, false);
  const reopened = await day(local);
  assert.equal(reopened.completed, 0);
  assert.equal(reopened.pendingTasks.length, 1);
  assert.equal(reopened.tasks[0]?.completion, "pending");
  assert.equal(reopened.tasks[0].delivery.hasPendingUpload, true);
  assert.equal(reopened.tasks[0].delivery.hasServerReceipt, true);
  const marker = mapTasks(reopened.tasks)[0];
  assert.ok(marker);
  assert.equal(markerState(marker).key, "mobile.day.pendingStatus");
  await store.applyChanges({
    assignments: [
      change(10, task({ is_completed: true })),
      change(11, task({ is_completed: true })),
    ],
  });
  assert.equal((await day(local)).completed, 0);
  await store.applyChanges({
    assignments: [{ ...change(12, {}), action: "remove", resource_version: "c".repeat(64) }],
  });
  await store.applyChanges({ assignments: [change(11, task({ is_completed: true }))] });
  assert.equal((await day(local)).tasks[0]?.completion, "unknown");
  assert.deepEqual(
    (await events(local)).map((row) => row.id),
    [received.id, pending.id],
  );
});

void test("malformed known task invalidates completion without consuming evidence or an invalid cursor", async () => {
  const local = await createStores();
  const store = new DayStore(local.db);
  await store.replace(bundle([task({ is_completed: true })]), FIXED_NOW);
  await local.outbox.enqueue(makeEnvelope({ payload: { task_id: TASK_ID } }));
  await store.applyChanges({ assignments: [change(11, task({ is_completed: "true" }))] });
  assert.equal((await day(local)).tasks[0]?.completion, "unknown");
  assert.equal((await store.read()).meta?.unreadable_rows, 1);
  await store.applyChanges({
    assignments: [change(12, task({ id: "different-task", is_completed: true }))],
  });
  assert.equal((await store.read()).meta?.unreadable_rows, 2);
  assert.equal(
    (await local.db.query("SELECT id FROM day_assignment WHERE id='different-task'")).length,
    0,
  );
  await store.applyChanges({ assignments: [change(14, task({ is_completed: true }))] });
  assert.equal((await day(local)).completed, 1);
  await store.applyChanges({ assignments: [change(15, { kind: "quadrant_assignment" })] });
  assert.equal((await day(local)).tasks[0]?.completion, "unknown");
  assert.equal((await store.read()).meta?.unreadable_rows, 3);
  await assert.rejects(
    store.applyChanges({ assignments: [{ ...change(13, task()), sequence: "invalid" }] }),
  );
  assert.equal(await local.kv.get("sync_cursor"), "signed-opaque-cursor");
  assert.equal((await events(local)).length, 1);
});

void test("real M08 delivery joins only unique captured point action and local date", async () => {
  const local = await createStores();
  const store = new DayStore(local.db);
  await store.replace(bundle(), FIXED_NOW);
  const event = await saveCapture(local);
  assert.equal((await day(local)).tasks[0]?.delivery.hasPendingUpload, true);
  assert.equal((await day(local)).completed, 0);
  await accept(local, event.id);
  assert.equal((await day(local)).tasks[0]?.delivery.hasServerReceipt, true);
  const origin = makeDraft({
    deviceTime: "2026-01-16T01:00:00.000Z",
    eventId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
    ovitrapId: "bbbbbbbb-bbbb-4bbb-8bbb-000000000002",
  });
  await saveCapture(local, origin);
  assert.equal((await day(local)).tasks[0]?.delivery.hasPendingUpload, true);
  assert.equal((await day(local)).tasks[0]?.delivery.hasServerReceipt, true);
  await store.replace(bundle([task(), task({ id: "duplicate-identity" })]), FIXED_NOW);
  assert.ok(
    (await day(local)).tasks.every(
      (row) => !row.delivery.hasServerReceipt && !row.delivery.hasPendingUpload,
    ),
  );
  for (const mismatch of [
    { date: "2026-01-16" },
    { point: "different-point" },
    { action: "place" },
  ]) {
    await store.replace(bundle([task(mismatch)]), FIXED_NOW);
    assert.equal((await day(local)).tasks[0]?.delivery.hasServerReceipt, false);
  }
  await store.replace(bundle(), FIXED_NOW);
  await local.outbox.enqueue(makeEnvelope({ payload: { ovitrap_id: "legacy-unlinked" } }));
  assert.equal((await events(local)).length, 3);
  assert.equal((await day(local)).tasks[0]?.delivery.hasServerReceipt, true);
});

/** Model immutable legacy history that predates complete captured organization provenance. */
async function legacyCapture(local: TestStores, draft: Draft) {
  const store = new OvitrapStore(local.db);
  await store.begin(draft);
  await local.outbox.enqueue(captureEvent(draft), [
    {
      sql: "INSERT INTO ovitrap_capture(event_id,ovitrap_id,mode,epi_week,draft) VALUES(?,?,?,?,?)",
      params: [draft.eventId, draft.ovitrapId, draft.mode, "2026-W03", JSON.stringify(draft)],
    },
  ]);
}
void test("missing captured timezone stays recoverable and never supplies delivery to another task", async () => {
  const local = await createStores();
  const draft = makeDraft({ deviceTime: "2026-01-15T10:00:00.000Z", assignment: null });
  await legacyCapture(local, draft);
  await new DayStore(local.db).replace(bundle(), FIXED_NOW);
  const model = await day(local);
  assert.equal(model.completed, 0);
  assert.equal(model.tasks[0]?.delivery.hasPendingUpload, false);
  assert.equal((await events(local))[0]?.local_status, "pending");
  assert.equal((await new OutboxWorkOverlay(local.db).read())[0]?.captureDate, null);
});

void test("review and rejected receipts remain distinct from authoritative completion", async () => {
  for (const action of ["review", "reject"] as const) {
    const local = await createStores();
    const event = await saveCapture(local);
    await local.outbox.claimPending(1);
    await local.outbox.settle([
      { id: event.id, action, result: { code: "test_receipt", params: {} } },
    ]);
    await new DayStore(local.db).replace(bundle(), FIXED_NOW);
    const before = await day(local);
    assert.equal(before.completed, 0);
    assert.equal(before.tasks[0]?.delivery.hasServerReceipt, true);
    assert.equal(before.tasks[0].delivery.isReviewPending, action === "review");
    assert.equal(before.tasks[0].delivery.hasRejectedReceipt, action === "reject");
    await new DayStore(local.db).replace(bundle([task({ is_completed: true })]), FIXED_NOW);
    assert.equal((await day(local)).completed, 1);
  }
});

function paged(result: SyncCallResult, assignments: ReturnType<typeof change>[]): SyncCallResult {
  assert.equal(result.ok, true);
  return {
    ...result,
    response: { ...result.response, changes: { ...result.response.changes, assignments } },
  };
}
function sync(local: TestStores, service: DayBundleService, replies: readonly SyncCallResult[]) {
  const script = scriptedTransport(replies);
  return {
    requests: script.requests,
    run: () =>
      runSyncPass(
        {
          ...local,
          ...service.syncHooks(),
          now: () => FIXED_NOW,
          deviceId: FIXED_DEVICE_ID,
          transport: script.transport,
        },
        { batchSize: 50 },
      ),
  };
}
void test("upload receipts and interrupted assignment pages never decide completion", async () => {
  const local = await createStores();
  const store = new DayStore(local.db);
  await store.replace(bundle(), FIXED_NOW);
  const event = await saveCapture(local);
  const service = () =>
    new DayBundleService({
      store: new DayStore(local.db),
      now: () => FIXED_NOW,
      transport: () =>
        Promise.resolve({ kind: "bundle", body: bundle([task({ is_completed: true })]) }),
    });
  const first = sync(local, service(), [
    answer([accepted(event.id)], { hasMore: true, cursor: "page-1" }),
    failure({ kind: "network" }),
  ]);
  assert.equal((await first.run()).kind, "retry");
  assert.equal((await day(local)).completed, 0);
  assert.equal((await day(local)).tasks[0]?.delivery.hasServerReceipt, true);
  const resumed = sync(local, service(), [
    paged(answer([], { hasMore: true, cursor: "page-2" }), [
      change(10, task({ is_completed: true })),
    ]),
    paged(answer([], { cursor: "page-3" }), [change(11, task())]),
  ]);
  assert.equal((await resumed.run()).kind, "idle");
  assert.ok(resumed.requests.every((request) => request.events.length === 0));
  assert.equal((await day(local)).completed, 0);
  const recovery = sync(local, service(), [httpFailure(400, "invalid_cursor"), answer([])]);
  assert.equal((await recovery.run()).kind, "idle");
  assert.equal((await day(local)).completed, 1);
  assert.equal((await events(local))[0]?.local_status, "sent");
});

void test("an upgraded stripped cache requires a committed full bootstrap across restart and preserves evidence", async () => {
  const root = realpathSync(tmpdir());
  const directory = mkdtempSync(join(root, "wolbachia-229-"));
  let phone = await openTestDatabase(join(directory, "completion.sqlite"));
  const stores = (): TestStores => ({
    db: phone.executor,
    kv: new KvStore(phone.executor),
    outbox: new OutboxRepository(phone.executor, () => FIXED_NOW),
  });
  let local = stores();
  try {
    const legacy = task();
    Reflect.deleteProperty(legacy, "is_completed");
    await new DayStore(local.db).replace(bundle([legacy]), FIXED_NOW);
    const originalPath = join(directory, "original-photo.jpg");
    const originalBytes = Buffer.from("immutable synthetic photo bytes");
    writeFileSync(originalPath, originalBytes);
    const captured = await saveCapture(
      local,
      makeDraft({
        deviceTime: "2026-01-16T01:00:00.000Z",
        evidence: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", fileRef: originalPath }],
      }),
    );
    await local.db.runAtomically([
      {
        sql: "INSERT INTO attachment_file(id,owner_key,draft_id) VALUES(?,?,?)",
        params: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "original-owner", captured.id],
      },
      {
        sql: "INSERT INTO attachment_event(evidence_id,event_id) VALUES(?,?)",
        params: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", captured.id],
      },
    ]);
    await local.db.runAtomically([
      { sql: "DELETE FROM kv WHERE key='day_completion_bootstrap_pending'" },
      { sql: "PRAGMA user_version=10" },
    ]);
    await migrate(local.db);
    assert.equal(await local.kv.get("day_completion_bootstrap_pending"), "true");
    const original = await local.db.query("SELECT * FROM ovitrap_capture");
    const evidence = await local.db.query("SELECT * FROM ovitrap_evidence");
    const journal = await local.db.query("SELECT * FROM attachment_file");
    const binding = await local.db.query("SELECT * FROM attachment_event");
    let response: BundleResult | Error = { kind: "unchanged" };
    const etags: (string | null)[] = [];
    const service = () =>
      new DayBundleService({
        store: new DayStore(local.db),
        now: () => FIXED_NOW,
        transport: (etag) => {
          etags.push(etag);
          return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
        },
      });
    await assert.rejects(service().refresh(), /requires a body/);
    response = new Error("offline");
    await assert.rejects(service().refresh(), /offline/);
    response = { kind: "bundle", body: bundle([task({ is_completed: true })]) };
    await local.db.query(
      "CREATE TRIGGER fail_completion_cursor BEFORE INSERT ON kv WHEN NEW.key='sync_cursor' BEGIN SELECT RAISE(ABORT,'write failed'); END",
    );
    await assert.rejects(service().refresh(), /write failed/);
    await local.db.query("DROP TRIGGER fail_completion_cursor");
    assert.equal(await local.kv.get("sync_cursor"), "signed-opaque-cursor");
    phone.close();
    phone = await openTestDatabase(join(directory, "completion.sqlite"));
    local = stores();
    await service().refresh();
    assert.equal((await day(local)).completed, 1);
    response = { kind: "unchanged" };
    await service().refresh();
    assert.deepEqual(etags, [null, null, null, null, "stable-v3-etag"]);
    assert.deepEqual(await local.db.query("SELECT * FROM ovitrap_capture"), original);
    assert.deepEqual(await local.db.query("SELECT * FROM ovitrap_evidence"), evidence);
    await local.kv.set("day_completion_bootstrap_pending", "true");
    await new DayStore(local.db).revoke();
    assert.equal(await local.kv.get("day_completion_bootstrap_pending"), "true");
    assert.deepEqual(await local.db.query("SELECT * FROM ovitrap_capture"), original);
    assert.deepEqual(await local.db.query("SELECT * FROM ovitrap_evidence"), evidence);
    assert.deepEqual(await local.db.query("SELECT * FROM attachment_file"), journal);
    assert.deepEqual(await local.db.query("SELECT * FROM attachment_event"), binding);
    assert.deepEqual(readFileSync(originalPath), originalBytes);
    assert.equal((await events(local))[0]?.local_status, "pending");
    response = { kind: "bundle", body: bundle([legacy]) };
    await service().refresh();
    assert.equal((await day(local)).tasks[0]?.completion, "unknown");
    response = { kind: "unchanged" };
    await service().refresh();
    assert.equal(etags.at(-1), "stable-v3-etag");
  } finally {
    phone.close();
    assert.equal(dirname(realpathSync(directory)), root);
    rmSync(directory, { recursive: true });
  }
});
