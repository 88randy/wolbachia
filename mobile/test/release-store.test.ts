import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ReleaseStore } from "../src/features/releases/store.ts";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { OWNER } from "./support/attachment-fixtures.ts";
import { createStores } from "./support/factories.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import {
  RELEASE_IDS,
  RELEASE_NOW,
  releaseDraft,
  releaseEnvelope,
} from "./support/release-fixtures.ts";

const TRUE_GUARD = { sql: "SELECT 1" };

void test("a no-file release draft prevents a different owner from activating the phone", async () => {
  const { db, hasLocalRecords } = await createStores();
  const store = new ReleaseStore(db),
    attachments = new AttachmentStore(db),
    draft = releaseDraft();
  await attachments.bindSession({ owner: OWNER, sessionId: "release-session" });
  assert.equal(await hasLocalRecords(), false);
  await store.begin(draft, [TRUE_GUARD]);
  assert.equal(await hasLocalRecords(), true);
  await assert.rejects(
    attachments.bindSession({
      owner: { ...OWNER, userId: RELEASE_IDS.assignment },
      sessionId: "other",
    }),
  );
});

void test("release identity pins and saved observations cannot be rewritten", async () => {
  const { db, outbox } = await createStores();
  const store = new ReleaseStore(db),
    draft = releaseDraft();
  await store.begin(draft, [TRUE_GUARD]);
  await assert.rejects(
    store.update(
      { ...draft, pins: { ...draft.pins, task: { ...draft.pins.task, owner_revision: 2 } } },
      [TRUE_GUARD],
    ),
    /identity is immutable/,
  );
  await outbox.enqueue(releaseEnvelope(draft), store.saveStatements(draft, [TRUE_GUARD]));
  await assert.rejects(
    db.runAtomically([
      {
        sql: "UPDATE release_draft SET draft=? WHERE id=?",
        params: [JSON.stringify({ ...draft, quantity: "3" }), draft.eventId],
      },
    ]),
    /observation is immutable/,
  );
});

void test("one task cannot be saved twice through different release devices", async () => {
  const { db, outbox } = await createStores();
  const store = new ReleaseStore(db),
    draft = releaseDraft();
  await store.begin(draft, [TRUE_GUARD]);
  await outbox.enqueue(releaseEnvelope(draft), store.saveStatements(draft, [TRUE_GUARD]));
  assert.equal(await store.taskCaptured(draft.ownerKey, draft.pins.task.id), true);
  const second = releaseDraft({
    eventId: RELEASE_IDS.assignment,
    pins: { ...draft.pins, device: { ...draft.pins.device, id: RELEASE_IDS.point } },
  });
  await store.begin(second, [TRUE_GUARD]);
  await assert.rejects(
    outbox.enqueue(releaseEnvelope(second), store.saveStatements(second, [TRUE_GUARD])),
    /could not be saved/,
  );
  assert.equal((await store.read(second.eventId, second.ownerKey))?.event, null);
  assert.equal((await db.query("SELECT id FROM outbox_event")).length, 1);
});

void test("an original raw-draft CAS aborts event enrollment after another editor wins", async () => {
  const { db, outbox } = await createStores();
  const store = new ReleaseStore(db),
    attachments = new AttachmentStore(db),
    draft = releaseDraft();
  const fence = await attachments.bindSession({ owner: OWNER, sessionId: "release-session" });
  assert.ok(fence);
  await store.begin(draft, [TRUE_GUARD]);
  const original = await store.read(draft.eventId, draft.ownerKey);
  assert.ok(original);
  const guard = store.draftGuard({ id: draft.eventId, raw: original.raw, fence });
  await store.update({ ...draft, quantity: "3.000000" }, [guard]);
  await assert.rejects(
    outbox.enqueue(releaseEnvelope(draft), store.saveStatements(draft, [guard])),
    /could not be saved/,
  );
  assert.equal((await db.query("SELECT id FROM outbox_event")).length, 0);
  const retained = await store.read(draft.eventId, draft.ownerKey);
  assert.ok(retained);
  assert.equal(retained.draft.quantity, "3.000000");
  assert.equal(retained.event, null);
});

void test("file-backed restart replays the original release UUID and retains a later critical rejection", async (context) => {
  const workspaceResults = fileURLToPath(new URL("../../test-results/", import.meta.url));
  await mkdir(workspaceResults, { recursive: true });
  const directory = await mkdtemp(join(workspaceResults, "release-store-139-"));
  let database = await openTestDatabase(join(directory, "phone.sqlite"));
  context.after(async () => {
    database.close();
    assert.ok(
      resolve(directory).startsWith(resolve(workspaceResults) + "/") ||
        resolve(directory).startsWith(resolve(workspaceResults) + "\\"),
    );
    await rm(directory, { recursive: true });
  });
  let store = new ReleaseStore(database.executor),
    outbox = new OutboxRepository(database.executor, () => RELEASE_NOW);
  const draft = releaseDraft(),
    envelope = releaseEnvelope(draft);
  await store.begin(draft, [TRUE_GUARD]);
  await outbox.enqueue(envelope, store.saveStatements(draft, [TRUE_GUARD]));
  const reservations = await store.reservations(draft.ownerKey, draft.pins.device.source_lot_id);
  assert.equal(reservations.entries.length, 1);
  await outbox.claimPending(1);
  database.close();
  database = await openTestDatabase(join(directory, "phone.sqlite"));
  store = new ReleaseStore(database.executor);
  outbox = new OutboxRepository(database.executor, () => RELEASE_NOW);
  assert.equal(await outbox.recoverInterrupted(), 1);
  assert.deepEqual((await outbox.claimPending(1))[0]?.envelope, envelope);
  await outbox.settle([
    {
      id: draft.eventId,
      action: "reject",
      result: { code: "release_permit_suspended", params: {} },
    },
  ]);
  const retained = await store.read(draft.eventId, draft.ownerKey);
  assert.equal(retained?.event?.result?.code, "release_permit_suspended");
  assert.deepEqual(retained.draft, draft);
  assert.equal(
    (await database.executor.query(reservations.guard.sql, reservations.guard.params)).length,
    0,
  );
  assert.equal((await database.executor.query("SELECT id FROM outbox_event")).length, 1);
});
