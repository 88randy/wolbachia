import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { SampleStore } from "../src/features/samples/store.ts";
import { sampleEvent } from "../src/features/samples/domain.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";
import { createStores } from "./support/factories.ts";
import { sampleDraft, sampleId } from "./support/sample-fixtures.ts";

const TRUE_GUARD = { sql: "SELECT 1" };
void test("no-file sample origins protect the owner and immutable sample UUID and source survive saved rejection", async () => {
  const { db, outbox, hasLocalRecords } = await createStores(),
    store = new SampleStore(db),
    draft = sampleDraft({ evidence: [] });
  const attachments = new AttachmentStore(db);
  await attachments.bindSession(PROJECTION_IDENTITY);
  await store.begin(draft, [TRUE_GUARD]);
  assert.equal(await hasLocalRecords(), true);
  await assert.rejects(
    attachments.bindSession({
      ...PROJECTION_IDENTITY,
      owner: { ...PROJECTION_IDENTITY.owner, userId: sampleId(90) },
    }),
  );
  await assert.rejects(
    store.begin({ ...draft, eventId: draft.sampleId, sampleId: draft.sampleId }, [TRUE_GUARD]),
  );
  await assert.rejects(
    store.update({ ...draft, sourceRef: { ...draft.sourceRef, id: sampleId(90) } }, [TRUE_GUARD]),
    /identity is immutable/,
  );
  await outbox.enqueue(sampleEvent(draft), store.saveStatements(draft, [TRUE_GUARD]));
  await outbox.settle([{ id: draft.eventId, action: "claim" }]);
  await outbox.settle([
    { id: draft.eventId, action: "reject", result: { code: "sample_code_reserved", params: {} } },
  ]);
  await assert.rejects(
    db.runAtomically([
      {
        sql: "UPDATE sample_draft SET draft=? WHERE id=?",
        params: [JSON.stringify({ ...draft, code: "different" }), draft.eventId],
      },
    ]),
    /observation is immutable/,
  );
  await assert.rejects(store.begin({ ...draft, eventId: sampleId(80) }, [TRUE_GUARD]));
  assert.deepEqual((await store.read(draft.sampleId, draft.ownerKey))?.draft, draft);
});
void test("a concurrent raw sample edit or evidence enrollment failure rolls back the event and saved flag", async () => {
  const { db, outbox } = await createStores(),
    store = new SampleStore(db),
    draft = sampleDraft({ evidence: [] });
  const fence = await new AttachmentStore(db).bindSession(PROJECTION_IDENTITY);
  assert.ok(fence);
  await store.begin(draft, [TRUE_GUARD]);
  const stale = store.draftGuard({ id: draft.sampleId, raw: JSON.stringify(draft), fence });
  await store.update({ ...draft, code: "  incomplete raw  " }, [TRUE_GUARD]);
  await assert.rejects(outbox.enqueue(sampleEvent(draft), store.saveStatements(draft, [stale])));
  assert.equal((await db.query("SELECT id FROM outbox_event")).length, 0);
  const retained = await store.read(draft.sampleId, draft.ownerKey);
  assert.ok(retained);
  const guard = store.draftGuard({ id: draft.sampleId, raw: retained.raw, fence });
  await assert.rejects(
    outbox.enqueue(sampleEvent(retained.draft), [
      ...store.saveStatements(retained.draft, [guard]),
      {
        sql: "INSERT INTO lifecycle_guard(slot,value) VALUES(1,0) ON CONFLICT(slot) DO UPDATE SET value=0",
      },
    ]),
  );
  assert.equal((await store.read(draft.sampleId, draft.ownerKey))?.event, null);
  assert.equal((await db.query("SELECT id FROM outbox_event")).length, 0);
});
