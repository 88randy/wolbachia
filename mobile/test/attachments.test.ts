import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { createStores, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import { FixtureEvidenceCapture as EvidenceCapture } from "./support/capture-fixture.ts";
import { readVerified } from "../src/attachments/owned-files.ts";
import { MAX_EVIDENCE_BYTES } from "../src/attachments/types.ts";
import {
  attachmentHarness,
  EVIDENCE_ID,
  PNG_BYTES,
  NOW,
  restoreCanonicalNineFixture,
} from "./support/attachment-fixtures.ts";
import { migrate, SCHEMA_VERSION } from "../src/db/migrations.ts";
import { captureEvent } from "../src/features/ovitrap-check/events.ts";
import { AttachmentSync } from "../src/attachments/attachment-sync.ts";
import { writeFile, readFile } from "node:fs/promises";
import { DayStore } from "../src/features/day/store.ts";
import { hasLocalRecords } from "../src/db/owner-data.ts";
import { prepareEvidenceSession } from "../src/attachments/prepare-session.ts";
import { CredentialStore, EMPTY_CREDENTIALS } from "../src/auth/credential-store.ts";
import { AuthController } from "../src/auth/auth-controller.ts";
import { acceptedEvidenceOwner } from "../src/attachments/accepted-owner.ts";
import { EvidenceSession } from "../src/attachments/evidence-session.ts";
import { deferred, loginResponse, memorySecrets } from "./support/auth-fakes.ts";
import { randomBytes } from "node:crypto";
import { captureConfiguration } from "../src/attachments/capture-configuration.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { makeDraft } from "./support/m-08-fixtures.ts";
import { harness } from "./support/m-08-harness.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { attachmentSyncHooks } from "../src/attachments/sync-hooks.ts";
import { accepted, answer } from "./support/scripted-transport.ts";
import { privateDirectoryFiles } from "../src/attachments/private-directory-files.ts";
import { createPhotoAcquisitionPort } from "../src/attachments/photo-acquisition.ts";
import { pathToFileURL } from "node:url";
import type { SqlExecutor, SqlStatement } from "../src/db/sql.ts";
import { ConcurrentCaptureError } from "../src/features/ovitrap-check/capture-identity.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { reportCaptureError } from "../src/features/ovitrap-check/use-capture-actions.ts";
import type { Snapshot } from "../src/features/ovitrap-check/service.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { ShiftOpenService } from "../src/features/shift-open/service.ts";
import { UNAVAILABLE_MAP } from "../src/features/shift-open/domain.ts";
import {
  captureShiftId,
  readCaptureShift,
} from "../src/features/ovitrap-check/shift-authorization.ts";

const OWNER = {
  issuer: "https://api.example.test",
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  deviceId: "33333333-3333-4333-8333-333333333333",
};
const ID = "66666666-6666-4666-8666-666666666666";
const FILE = {
  id: ID,
  fileRef: "owned-file",
  contentType: "image/jpeg" as const,
  sizeBytes: 4,
  sha256: "a".repeat(64),
};

void test("canonical schema 9 upgrade retains legacy capture without relabelling or scheduling untransferable declared evidence", async (test) => {
  const local = await attachmentHarness(test);
  const store = new OvitrapStore(local.db);
  const draft = makeDraft({ evidence: [{ id: ID, fileRef: "legacy-private-reference" }] });
  await store.begin(draft);
  await local.outbox.enqueue(
    { ...captureEvent(draft), payload: { ovitrap_id: draft.ovitrapId } },
    store.commitStatements(draft, (await store.read()).draftVersion),
  );
  const declared = makeEnvelope({ type: "ovitrap.place", payload: { evidence_ids: [ID] } });
  await local.outbox.enqueue(declared);
  await local.outbox.claimPending(50);
  await local.outbox.settle(
    [draft.eventId, declared.id].map((id) => ({
      id,
      action: "release" as const,
      retryAt: new Date(NOW.getTime() - 1).toISOString(),
    })),
  );
  await restoreCanonicalNineFixture(local.db);
  const history = await local.db.query("SELECT id,payload,device_time,retry_at FROM outbox_event");
  const references = await local.db.query("SELECT * FROM ovitrap_evidence");
  await migrate(local.db);
  assert.equal((await local.db.query("PRAGMA user_version"))[0]?.user_version, SCHEMA_VERSION);
  assert.deepEqual(
    await local.db.query("SELECT id,payload,device_time,retry_at FROM outbox_event"),
    history,
  );
  assert.deepEqual(await local.db.query("SELECT * FROM ovitrap_evidence"), references);
  assert.equal((await local.db.query("SELECT id FROM attachment_file")).length, 0);
  assert.equal((await local.outbox.countByStatus()).pending, 2);
  const reopened = await local.reopen();
  const unexpected = () => Promise.reject(new Error("Legacy ownership cannot be assigned"));
  const sync = new AttachmentSync({
    ...reopened,
    files: local.files,
    now: () => NOW,
    transport: { authorize: unexpected, renew: unexpected, put: unexpected, finalize: unexpected },
  });
  const scheduled: number[] = [];
  const batches: string[][] = [];
  const engine = new SyncEngine({
    pass: {
      ...reopened,
      now: () => NOW,
      deviceId: OWNER.deviceId,
      attachments: attachmentSyncHooks({ ...reopened, sync }),
      transport: (batch) => {
        batches.push(batch.events.map((event) => event.id));
        return Promise.resolve(answer(batch.events.map((event) => accepted(event.id))));
      },
    },
    hasSession: () => true,
    hasServer: () => true,
    hasPendingFinalUpload: () => Promise.resolve(false),
    random: () => 0,
    schedule: (_, delay) => {
      scheduled.push(delay);
      return () => undefined;
    },
    report: (error) => {
      throw error;
    },
  });
  engine.setOnline(true);
  await engine.requestSync();
  assert.deepEqual(scheduled, []);
  assert.deepEqual(batches, [[draft.eventId]]);
  assert.equal((await reopened.outbox.countByStatus()).pending, 1);
  assert.equal((await reopened.db.query("SELECT id FROM attachment_file")).length, 0);
  assert.deepEqual(await reopened.db.query("SELECT * FROM ovitrap_evidence"), references);
});

void test("producer-shaped place/check/replace/relocate/remove keep exact captured evidence UUIDs and readiness", async (test) => {
  const h = await attachmentHarness(test);
  const declarations: { eventId: string; evidenceId: string }[] = [];
  const kinds = ["place", "check", "replace", "relocate", "remove"] as const;
  for (const [index, kind] of kinds.entries()) {
    const id = `eeeeeeee-eeee-4eee-8eee-${String(index).padStart(12, "0")}`;
    const draft = makeDraft({
      eventId: makeEnvelope().id,
      mode: kind === "place" ? "place" : "check",
      evidence: [{ id, fileRef: h.source }],
    });
    const payload = {
      ovitrap_id: draft.ovitrapId,
      reason_code: "other",
      other_text: "Synthetic capture reason",
      evidence_ids: [id],
      ...(kind === "replace" ? { replacement_id: "77777777-7777-4777-8777-777777777777" } : {}),
      ...(kind === "relocate" ? { proposed_location: [-99, 19] } : {}),
      ...(kind === "remove" ? { is_recovered: false } : {}),
    };
    const event =
      kind === "place" || kind === "check"
        ? captureEvent(draft)
        : { ...captureEvent(draft), type: `ovitrap.${kind}`, payload };
    assert.ok(
      await new EvidenceCapture(h).capture(
        { capture: () => Promise.resolve({ id, fileRef: h.source }) },
        event.id,
      ),
    );
    await h.outbox.enqueue(
      event,
      h.store.bindingStatements({
        eventId: event.id,
        evidenceIds: [id],
        fence: await h.session.capture(),
      }),
    );
    declarations.push({ eventId: event.id, evidenceId: id });
  }
  assert.deepEqual(await h.outbox.claimPending(50, await h.session.selection()), []);
  const uploaded: string[] = [];
  const sync = new AttachmentSync({
    ...h,
    now: () => NOW,
    transport: {
      authorize: (call) => {
        uploaded.push(call.file.id);
        return Promise.resolve({
          state: "authorized",
          verifiedAt: null,
          grant: { lease: "test-lease", contentType: "image/png" },
        });
      },
      renew: () => Promise.reject(new Error("Unexpected renew")),
      put: () => Promise.resolve(),
      finalize: () => Promise.resolve(NOW.toISOString()),
    },
  });
  for (let remaining = declarations.length; remaining > 0; remaining--)
    assert.equal(await sync.advanceOne(), true);
  const claimed = await h.outbox.claimPending(50, await h.session.selection());
  assert.deepEqual(
    claimed.map((event) => ({
      eventId: event.envelope.id,
      evidenceId: (event.envelope.payload.evidence_ids as string[])[0],
    })),
    declarations,
  );
  assert.deepEqual(
    uploaded,
    declarations.map((item) => item.evidenceId),
  );
});

void test("evidence journal retains immutable owner and rejects stale verification after revocation", async () => {
  const local = await createStores();
  const store = new AttachmentStore(local.db);
  const fence = await store.bindSession({ owner: OWNER, sessionId: "session-one" });
  assert.ok(fence);
  const event = makeEnvelope({ payload: { evidence_ids: [ID] } });
  await store.reserve({ id: ID, draftId: event.id, fence });
  await store.saveOwned(FILE, fence);
  await local.outbox.enqueue(
    event,
    store.bindingStatements({ eventId: event.id, evidenceIds: [ID], fence }),
  );
  assert.equal((await store.next(fence, FIXED_NOW.toISOString()))?.file.id, ID);
  await store.bindSession(null);
  assert.equal(
    await store.saveProgress({
      id: ID,
      fence,
      state: "verified",
      attemptVersion: 0,
      verifiedAt: FIXED_NOW.toISOString(),
    }),
    false,
  );
  await assert.rejects(async () =>
    local.db.query("UPDATE attachment_file SET owner_key='new-owner' WHERE id=?", [ID]),
  );
  assert.equal((await local.outbox.countByStatus()).pending, 1);
  assert.equal((await local.db.query("SELECT id FROM attachment_file")).length, 1);
});

void test("SecureStore failure after owner CAS cannot activate credentials or strand proven owner's files and retry", async (test) => {
  const h = await attachmentHarness(test);
  const event = makeEnvelope({ payload: { evidence_ids: [EVIDENCE_ID] } });
  const saved = await new EvidenceCapture(h).capture(
    { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
    event.id,
  );
  assert.ok(saved);
  await h.outbox.enqueue(
    event,
    h.store.bindingStatements({
      eventId: event.id,
      evidenceIds: [EVIDENCE_ID],
      fence: await h.session.capture(),
    }),
  );
  const source = loginResponse();
  const organization = {
    id: OWNER.organizationId,
    slug: "test",
    name: "Test",
    country: "MX",
    timezone: "America/Mexico_City",
    languages: ["es-MX"],
    epi_week: "iso" as const,
    label_phone: "",
    support_contact: "",
    logo_url: null,
  };
  const response = {
    ...source,
    me: { ...source.me, user: { ...source.me.user, id: OWNER.userId }, organization },
  };
  const secrets = memorySecrets();
  const entered = deferred<undefined>();
  const blocked = deferred<undefined>();
  let shouldFail = false;
  const credentials = new CredentialStore({
    get: (key) => secrets.get(key),
    set: (key, value) => {
      if (shouldFail) {
        entered.resolve(undefined);
        return blocked.promise;
      }
      return secrets.set(key, value);
    },
  });
  await credentials.update(() => ({
    ...EMPTY_CREDENTIALS,
    status: "ended",
    origin: OWNER.issuer,
    sessionId: "session-one",
  }));
  await h.kv.set(
    "session_profile",
    JSON.stringify({
      username: source.me.user.username,
      firstName: "Test",
      userId: OWNER.userId,
      organization,
      permissions: [],
      issuer: OWNER.issuer,
      sessionId: "session-one",
    }),
  );
  const auth = new AuthController({
    ...h,
    credentials,
    hasLocalRecords: () => hasLocalRecords(h.db),
    now: () => NOW.getTime(),
    randomBytes,
    login: () => Promise.resolve({ ok: true, login: response, origin: OWNER.issuer }),
    fetchRules: () => Promise.resolve(null),
    prepareEvidenceSession: (identity) =>
      prepareEvidenceSession({ ...identity, db: h.db, deviceId: OWNER.deviceId }),
  });
  await auth.load();
  auth.setOnline(true);
  shouldFail = true;
  const login = auth.login(source.me.user.username, "pw-for-evidence-fixture");
  await entered.promise;
  const current = () =>
    acceptedEvidenceOwner({
      profile: auth.getSnapshot().profile,
      credentials: credentials.getSnapshot(),
      deviceId: OWNER.deviceId,
    });
  assert.equal(current(), null);
  assert.equal(credentials.getSnapshot().pair, null);
  const session = new EvidenceSession({ store: h.store, current, isFinal: () => false });
  await assert.rejects(() => session.capture(), /owner_unproven/);
  blocked.reject(new Error("SecureStore refused"));
  await assert.rejects(() => login, /SecureStore refused/);
  assert.equal(auth.canLogin(), true);
  assert.equal((await h.outbox.countByStatus()).pending, 1);
  assert.deepEqual(await readFile(saved.fileRef), PNG_BYTES);
  shouldFail = false;
  await auth.login(source.me.user.username, "pw-for-evidence-fixture");
  assert.ok(current());
  const pending = await h.store.next(await session.capture(), NOW.toISOString());
  assert.equal(pending?.file.id, EVIDENCE_ID);
  assert.equal((await h.db.query("SELECT id FROM outbox_event"))[0]?.id, event.id);
});

void test("exclusive owned capture checks exact bytes/hash and survives SQLite restart without assigning legacy references", async (test) => {
  const h = await attachmentHarness(test);
  const capture = new EvidenceCapture(h);
  const event = makeEnvelope({ payload: { evidence_ids: [EVIDENCE_ID] } });
  const saved = await capture.capture(
    { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
    event.id,
  );
  assert.ok(saved);
  assert.equal(await hasLocalRecords(h.db), true);
  const fence = await h.session.capture();
  await h.outbox.enqueue(
    event,
    h.store.bindingStatements({ eventId: event.id, evidenceIds: [EVIDENCE_ID], fence }),
  );
  const reopened = await h.reopen();
  const pending = await reopened.store.next(await reopened.session.capture(), NOW.toISOString());
  assert.ok(pending);
  assert.deepEqual(await readVerified(h.files, pending.file), new Uint8Array(PNG_BYTES));
  await assert.rejects(async () =>
    capture.capture({ capture: () => Promise.resolve(saved) }, event.id),
  );
  await writeFile(saved.fileRef, PNG_BYTES.subarray(0, 8));
  await assert.rejects(() => readVerified(h.files, pending.file), /file_changed/);
  assert.equal((await reopened.outbox.countByStatus()).pending, 1);
});

void test("bounded copy and private path failures retain photo errors without blocking unrelated sync", async (test) => {
  const h = await attachmentHarness(test);
  await writeFile(h.source, Buffer.alloc(MAX_EVIDENCE_BYTES + 1));
  const capture = new EvidenceCapture(h);
  await assert.rejects(
    () =>
      capture.capture(
        { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
        "draft",
      ),
    /file_size/,
  );
  const [row] = await h.db.query("SELECT metadata,state FROM attachment_file WHERE id=?", [
    EVIDENCE_ID,
  ]);
  assert.ok(row);
  assert.equal(row.metadata, null);
  assert.equal(row.state, "adopting");
  let files = h.files;
  let readersClosed = 0;
  const failedIds = [
    "77777777-7777-4777-8777-777777777777",
    "88888888-8888-4888-8888-888888888888",
  ];
  for (const [index, id] of failedIds.entries()) {
    let directoryCalls = 0;
    files = privateDirectoryFiles({
      directory: () => {
        directoryCalls++;
        if (!index) throw new Error("private path unavailable");
        return {
          uri: "file:///private/private-evidence/",
          prepare: () => {
            throw new Error("disk full");
          },
          createExclusive: () => Promise.reject(new Error("Unexpected destination creation")),
        };
      },
      openRead: async (ref) => {
        const reader = await h.files.openRead(ref);
        return {
          read: (length) => reader.read(length),
          close: async () => {
            await reader.close();
            readersClosed++;
          },
        };
      },
    });
    assert.equal(directoryCalls, 0);
    await assert.rejects(() => files.createExclusive("../invalid"), /file_identity/);
    assert.equal(directoryCalls, 0);
    const failed = new EvidenceCapture({ ...h, files });
    await assert.rejects(
      () =>
        failed.capture(
          { capture: () => Promise.resolve({ id, fileRef: h.source }) },
          "failed-draft",
        ),
      index ? /disk full/ : /private path unavailable/,
    );
    if (index) {
      assert.equal(files.owns(`file:///private/private-evidence/${id}`), true);
      assert.equal(files.owns(`file:///private/private-evidence/../${id}`), false);
      assert.equal(files.owns(`file:///private/private-evidence-other/${id}`), false);
    }
  }
  assert.equal(readersClosed, 2);
  assert.deepEqual(
    (
      await h.db.query(
        "SELECT id,last_error,metadata FROM attachment_file WHERE id IN (?,?) ORDER BY id",
        failedIds,
      )
    ).map((failure) => ({ ...failure })),
    failedIds.map((id) => ({ id, last_error: "file_unavailable", metadata: null })),
  );
  assert.equal(
    (await h.db.query("SELECT id FROM attachment_file WHERE metadata IS NULL")).length,
    3,
  );
  assert.equal((await h.outbox.countByStatus()).pending, 0);
  assert.equal(await hasLocalRecords(h.db), true);
  const unrelated = makeEnvelope({ payload: { evidence_ids: [] } });
  await h.outbox.enqueue(unrelated);
  const unexpected = () => Promise.reject(new Error("Unconfirmed photos cannot upload"));
  const sync = new AttachmentSync({
    ...h,
    files,
    now: () => NOW,
    transport: { authorize: unexpected, renew: unexpected, put: unexpected, finalize: unexpected },
  });
  const batches: string[][] = [];
  const engine = new SyncEngine({
    pass: {
      ...h,
      now: () => NOW,
      deviceId: OWNER.deviceId,
      attachments: attachmentSyncHooks({ ...h, sync }),
      transport: (batch) => {
        batches.push(batch.events.map((event) => event.id));
        return Promise.resolve(
          answer(
            batch.events.map((event) => accepted(event.id)),
            { cursor: "healthy-pull" },
          ),
        );
      },
    },
    hasSession: () => true,
    hasServer: () => true,
    hasPendingFinalUpload: () => Promise.resolve(false),
    random: () => 0,
    schedule: () => {
      throw new Error("Local photo failures need no sync timer");
    },
    report: (error) => {
      throw error;
    },
  });
  engine.setOnline(true);
  await engine.requestSync();
  assert.deepEqual(batches, [[unrelated.id]]);
  assert.equal((await h.outbox.countByStatus()).sent, 1);
  assert.equal(await h.kv.get("sync_cursor"), "healthy-pull");
  assert.equal(
    (await h.db.query("SELECT id FROM attachment_file WHERE metadata IS NULL")).length,
    3,
  );
});

void test("legacy undeclared evidence cannot be adopted by a fresh session or repaired in its immutable event", async (test) => {
  const h = await attachmentHarness(test);
  const original = makeEnvelope({
    payload: { ovitrap_id: "44444444-4444-4444-8444-444444444444" },
  });
  await h.outbox.enqueue(original);
  await h.db.query("INSERT INTO ovitrap_evidence(event_id,evidence_id,file_ref) VALUES(?,?,?)", [
    original.id,
    EVIDENCE_ID,
    h.source,
  ]);
  const capture = new EvidenceCapture(h);
  await assert.rejects(
    () =>
      capture.capture(
        { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
        "new-draft",
      ),
    /stale_context/,
  );
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 0);
  await assert.rejects(async () =>
    h.db.query("UPDATE outbox_event SET payload=? WHERE id=?", [
      JSON.stringify({ evidence_ids: [EVIDENCE_ID] }),
      original.id,
    ]),
  );
  assert.deepEqual(await readFile(h.source), PNG_BYTES);
});

void test("eligibility before LIMIT skips over 50 blocked files but retains real void/replacement/check dependencies", async () => {
  const local = await createStores();
  const store = new AttachmentStore(local.db);
  const fence = await store.bindSession({ owner: OWNER, sessionId: "one" });
  assert.ok(fence);
  let first = "";
  for (let index = 0; index < 51; index++) {
    const event = makeEnvelope({
      type: "ovitrap.replace",
      payload: {
        ovitrap_id: `trap-${String(index)}`,
        replacement_id: `new-${String(index)}`,
        evidence_ids: [ID],
      },
    });
    if (!index) first = event.id;
    await local.outbox.enqueue(event);
  }
  const voided = makeEnvelope({
    type: "record.void",
    voids_event_id: first,
    payload: { reason_code: "other", reason: "Incorrect captured target" },
  });
  const replacement = makeEnvelope({ payload: { ovitrap_id: "trap-0", evidence_ids: [] } });
  const check = makeEnvelope({ payload: { ovitrap_id: "new-0", evidence_ids: [] } });
  const unrelated = makeEnvelope({ payload: { ovitrap_id: "unrelated", evidence_ids: [] } });
  for (const event of [voided, replacement, check, unrelated]) await local.outbox.enqueue(event);
  await local.db.query("INSERT INTO ovitrap_lineage VALUES(?,?,?)", [
    voided.id,
    first,
    replacement.id,
  ]);
  await local.db.query("UPDATE outbox_event SET retry_at=?", [
    new Date(FIXED_NOW.getTime() - 1).toISOString(),
  ]);
  await local.db.query("UPDATE outbox_event SET retry_at=? WHERE id=?", [
    new Date(FIXED_NOW.getTime() + 750).toISOString(),
    unrelated.id,
  ]);
  assert.equal(await local.outbox.nextRetryDelayMs({ fence, isFinal: false }), 750);
  assert.equal(await local.outbox.nextRetryDelayMs({ fence: null, isFinal: false }), 750);
  assert.equal(await local.outbox.nextRetryDelayMs({ fence, isFinal: true }), 0);
  assert.deepEqual(await local.outbox.claimPending(50, { fence, isFinal: false }), []);
  await local.db.query("UPDATE outbox_event SET retry_at=NULL WHERE id=?", [unrelated.id]);
  assert.deepEqual(
    (await local.outbox.claimPending(50, { fence, isFinal: false })).map(
      (event) => event.envelope.id,
    ),
    [unrelated.id],
  );
  assert.equal((await local.outbox.countByStatus()).pending, 54);
  assert.equal(await local.outbox.nextRetryDelayMs({ fence, isFinal: false }), null);
  await store.bindSession(null);
  assert.equal(await local.outbox.nextRetryDelayMs({ fence, isFinal: true }), null);
});

void test("scope revocation at the actual claim barrier defeats an old fence and retains original file/event", async (test) => {
  const h = await attachmentHarness(test);
  const fence = await h.session.capture();
  const event = makeEnvelope({ payload: { evidence_ids: [] } });
  await h.outbox.enqueue(event);
  const { OutboxRepository } = await import("../src/outbox/outbox-repository.ts");
  const racing = new OutboxRepository(
    {
      ...h.db,
      query: async (sql, params) => {
        if (sql.startsWith("WITH RECURSIVE")) await new DayStore(h.db).revoke();
        return h.db.query(sql, params);
      },
    },
    () => NOW,
  );
  assert.deepEqual(await racing.claimPending(50, { fence, isFinal: false }), []);
  assert.equal((await h.outbox.countByStatus()).pending, 1);
  assert.deepEqual(await readFile(h.source), PNG_BYTES);
});

void test("owned capture wiring commits M08 reference, binding and original event together before Saved", async (test) => {
  const h = await attachmentHarness(test);
  const secondId = "77777777-7777-4777-8777-777777777777";
  let captures = 0;
  const configuration = captureConfiguration({
    store: new OvitrapStore(h.db),
    port: createPhotoAcquisitionPort({
      uuid: () => (captures++ ? secondId : EVIDENCE_ID),
      canStart: () => true,
      picker: {
        getPendingResultAsync: () => Promise.resolve(null),
        getCameraPermissionsAsync: () => Promise.resolve({ granted: true, canAskAgain: true }),
        requestCameraPermissionsAsync: () =>
          Promise.reject(new Error("Unexpected permission request")),
        launchCameraAsync: () =>
          Promise.resolve({
            canceled: false,
            assets: [{ uri: pathToFileURL(h.source).href, width: 1, height: 1 }],
          }),
      },
    }),
    attachments: { ...h, capture: new EvidenceCapture(h) },
  });
  const wired = await harness(h, configuration);
  const draft = makeDraft({
    paddlePresent: false,
    prepared: ["clean", "water", "liner"],
    reviewAcknowledged: true,
  });
  await wired.store.begin(draft);
  assert.equal(await wired.service.captureEvidence(draft.eventId), true);
  assert.equal(await h.store.next(await h.session.capture(), NOW.toISOString()), null);
  assert.equal(await wired.service.captureEvidence(draft.eventId), true);
  const before = await wired.store.read();
  assert.ok(before.draft);
  await wired.service.undoEvidence(draft.eventId, EVIDENCE_ID);
  await wired.service.undoEvidence(draft.eventId, EVIDENCE_ID);
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 2);
  assert.equal(await h.store.next(await h.session.capture(), NOW.toISOString()), null);
  const snapshot = await wired.service.save(draft.eventId);
  assert.equal(snapshot.event?.envelope.id, draft.eventId);
  assert.deepEqual(snapshot.event.envelope.payload.evidence_ids, [secondId]);
  const [binding] = await h.db.query("SELECT evidence_id,event_id FROM attachment_event");
  assert.equal(binding?.event_id, draft.eventId);
  assert.equal(binding.evidence_id, secondId);
  assert.equal(
    (await h.store.next(await h.session.capture(), NOW.toISOString()))?.file.id,
    secondId,
  );
  assert.equal((await h.outbox.claimPending(50, await h.session.selection())).length, 0);
  await assert.rejects(wired.service.undoEvidence(draft.eventId, secondId), /immutable/i);
  assert.deepEqual((await wired.store.read()).event?.envelope, snapshot.event.envelope);
});

void test("native capture cannot adopt into a draft replaced while the camera is open", async (test) => {
  const h = await attachmentHarness(test);
  const camera = deferred<{ id: string; fileRef: string }>();
  const opened = deferred<undefined>();
  const store = new OvitrapStore(h.db);
  const configuration = captureConfiguration({
    store,
    port: {
      capture: () => {
        opened.resolve(undefined);
        return camera.promise;
      },
    },
    attachments: { ...h, capture: new EvidenceCapture(h) },
  });
  const wired = await harness(h, configuration);
  const original = makeDraft();
  await store.begin(original);
  const capture = wired.service.captureEvidence(original.eventId);
  await opened.promise;
  const replacement = makeDraft({
    eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    shiftId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  });
  await store.begin(replacement);
  camera.resolve({ id: EVIDENCE_ID, fileRef: h.source });
  await assert.rejects(capture);
  assert.deepEqual(await h.db.query("SELECT id FROM attachment_file"), []);
  assert.deepEqual((await store.read()).draft?.evidence, []);
});

void test("the exact unsaved draft is checked inside the reservation INSERT, before file I/O", async (test) => {
  const h = await attachmentHarness(test);
  const draftStore = new OvitrapStore(h.db);
  let copies = 0;
  let hasReplaced = false;
  const db = {
    ...h.db,
    query: async (sql: string, params?: import("../src/db/sql.ts").SqlStatement["params"]) => {
      if (sql.includes("INSERT INTO attachment_file") && !hasReplaced) {
        hasReplaced = true;
        await draftStore.begin(
          makeDraft({ eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", shiftId: "new-shift" }),
        );
      }
      return h.db.query(sql, params);
    },
  };
  const configuration = captureConfiguration({
    store: draftStore,
    port: { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
    attachments: {
      ...h,
      capture: new EvidenceCapture({
        ...h,
        store: new AttachmentStore(db),
        files: {
          ...h.files,
          createExclusive: (id) => {
            copies++;
            return h.files.createExclusive(id);
          },
        },
      }),
    },
  });
  const wired = await harness(h, configuration);
  const draft = makeDraft();
  await draftStore.begin(draft);
  await assert.rejects(wired.service.captureEvidence(draft.eventId), /stale_context/);
  assert.equal(hasReplaced, true);
  assert.equal(copies, 0);
  assert.deepEqual(await h.db.query("SELECT id FROM attachment_file"), []);
});

const PUBLICATION_ORDERS = [
  "target-first",
  "temperature-first",
  "revocation-first",
  "assignment-first",
  "photo-first",
  "stale-save",
  "shift-severe-first",
] as const;
type PublicationOrder = (typeof PUBLICATION_ORDERS)[number];
interface WriterOutcome {
  readonly applied: boolean;
  readonly error?: unknown;
}
interface PhotoOutcome {
  readonly value: boolean;
  readonly error: unknown;
}

function publicationCamera(source: string) {
  return createPhotoAcquisitionPort({
    uuid: () => EVIDENCE_ID,
    canStart: () => true,
    picker: {
      getPendingResultAsync: () => Promise.resolve(null),
      getCameraPermissionsAsync: () => Promise.resolve({ granted: true, canAskAgain: true }),
      requestCameraPermissionsAsync: () =>
        Promise.reject(new Error("Unexpected permission request")),
      launchCameraAsync: () =>
        Promise.resolve({
          canceled: false,
          assets: [{ uri: pathToFileURL(source).href, width: 1, height: 1 }],
        }),
    },
  });
}
async function publicationShift(
  h: Awaited<ReturnType<typeof attachmentHarness>>,
  engine: SyncEngine,
) {
  const store = new ShiftOpenStore(h.db);
  const item = makeDraft().catalog?.findings[0];
  assert.ok(item);
  await store.saveCatalog({ version: "motorcycle-v1", items: [item] });
  await store.saveMap({
    ...UNAVAILABLE_MAP,
    status: "ready",
    version: "maps-v1",
    progress: 100,
    requiredCoverage: ["Q-1"],
    coverage: ["Q-1"],
    assets: [{ id: "Q-1.pmtiles", license: "licensed", size: 10 }],
    verifiedAssets: [{ id: "Q-1.pmtiles", fileRef: "file:///Q-1.pmtiles", size: 10 }],
  });
  let ids = 0;
  const shift = new ShiftOpenService({
    store,
    engine,
    now: () => NOW,
    uuid: () => (ids++ ? "99999999-9999-4999-8999-999999999999" : makeDraft().shiftId),
    maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
    photos: { capture: () => Promise.resolve({ status: "unavailable" }) },
  });
  const beforeStart = await shift.read();
  assert.equal(beforeStart.draft, null);
  assert.equal(beforeStart.catalog?.version, "motorcycle-v1");
  assert.equal(beforeStart.map?.version, "maps-v1");
  await shift.start();
  await shift.update({ motorcycle_code: "M-TEST" });
  await shift.update({ odometer_km: "100", checks: [{ item: item.code, result: "ok" }] });
  assert.equal((await shift.open()).canDepart, true);
  return shift;
}
async function publicationFixture(
  scenario: import("node:test").TestContext,
  order: PublicationOrder,
) {
  const h = await attachmentHarness(scenario);
  const held = deferred<undefined>();
  const release = deferred<undefined>();
  let didIntercept = false;
  const initial = makeDraft({
    paddlePresent: false,
    prepared: ["clean", "water", "liner"],
    reviewAcknowledged: true,
  });
  assert.ok(initial.point);
  assert.ok(initial.assignment);
  const secondPoint = {
    ...initial.point,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    code: "OV-2",
  };
  const draft = {
    ...initial,
    assignment: { ...initial.assignment, points: [initial.point, secondPoint] },
  };
  const otherFirst = order === "photo-first" || order === "stale-save";
  const hold = async () => {
    didIntercept = true;
    held.resolve(undefined);
    await release.promise;
  };
  const proxy: SqlExecutor = {
    ...h.db,
    query: async (sql, params) => {
      await intercept(sql, params);
      return h.db.query(sql, params);
    },
    runAtomically: async (statements) => {
      if (
        order === "stale-save" &&
        !didIntercept &&
        statements.some((item) => item.sql.startsWith("INSERT INTO ovitrap_capture"))
      )
        await hold();
      await h.db.runAtomically(statements);
    },
  };
  const store = new OvitrapStore(otherFirst ? h.db : proxy);
  const configuration = captureConfiguration({
    store,
    port: publicationCamera(h.source),
    attachments: { ...h, capture: new EvidenceCapture(h) },
  });
  const shiftId = async () => (shift === null ? draft.shiftId : captureShiftId(await shift.read()));
  const guardedShift =
    order === "shift-severe-first"
      ? {
          evidenceShift: async () => {
            assert.ok(shift);
            return readCaptureShift(shift);
          },
        }
      : {};
  const capture = await harness(h, { ...configuration, ...guardedShift, store, shiftId });
  const shift: ShiftOpenService | null =
    order === "shift-severe-first" ? await publicationShift(h, capture.engine) : null;
  const other = await harness(
    order === "stale-save"
      ? { ...h, db: proxy, outbox: new OutboxRepository(proxy, () => NOW) }
      : h,
    {
      ...configuration,
      ...guardedShift,
      store: new OvitrapStore(otherFirst ? proxy : h.db),
      shiftId,
    },
  );
  const before: Record<PublicationOrder, () => Promise<unknown>> = {
    "target-first": () =>
      other.service.update({ point: secondPoint, temperature: "37" }, draft.eventId),
    "temperature-first": () => other.service.update({ temperature: "37" }, draft.eventId),
    "revocation-first": () => new DayStore(h.db).revoke(),
    "assignment-first": async () =>
      store.saveSnapshots({ ...(await store.snapshots()), assignment: null }),
    "photo-first": hold,
    "stale-save": hold,
    "shift-severe-first": async () => {
      assert.ok(shift);
      const beforeGeneration = await h.db.query("SELECT generation FROM attachment_context");
      const beforeAssignment = (await store.snapshots()).assignment;
      const opening = (await shift.read()).opening;
      assert.ok(opening);
      await h.outbox.claimPending(10);
      await h.outbox.settle([
        { id: opening.envelope.id, action: "review", result: { code: "severe_check", params: {} } },
      ]);
      const blocked = await shift.read();
      assert.equal(blocked.gate, "severe");
      assert.equal(blocked.canDepart, false);
      assert.deepEqual(
        await h.db.query("SELECT generation FROM attachment_context"),
        beforeGeneration,
      );
      assert.deepEqual((await store.snapshots()).assignment, beforeAssignment);
    },
  };
  async function intercept(sql: string, params?: SqlStatement["params"]) {
    if (order === "stale-save" || didIntercept || !sql.startsWith("UPDATE ovitrap_draft SET draft"))
      return;
    const isPhoto = sql.includes("json_insert") || String(params?.[0]).includes(EVIDENCE_ID);
    if (isPhoto === otherFirst) return;
    didIntercept = true;
    await before[order]();
  }
  await store.saveSnapshots({ ...(await store.snapshots()), assignment: draft.assignment });
  await store.begin(draft);
  return {
    h,
    held,
    release,
    capture,
    other,
    store,
    draft,
    secondPoint,
    didIntercept: () => didIntercept,
  };
}
type PublicationFixture = Awaited<ReturnType<typeof publicationFixture>>;

async function holdPublicWriter(f: PublicationFixture, order: PublicationOrder) {
  if (order !== "photo-first" && order !== "stale-save") return null;
  if (order === "photo-first")
    f.other.service.draftBuffer.edit(f.draft.eventId, { temperature: "37" });
  const operation =
    order === "stale-save"
      ? f.other.service.save(f.draft.eventId)
      : f.other.service.draftBuffer.persist(f.other.service, f.draft.eventId);
  const completion = operation.then(
    (): WriterOutcome => ({ applied: true }),
    (error: unknown): WriterOutcome => ({ applied: false, error }),
  );
  await Promise.race([
    f.held.promise,
    completion.then((outcome) => {
      if (outcome.error instanceof Error) throw outcome.error;
      throw new Error("Writer completed before the held boundary");
    }),
  ]);
  return { completion };
}
async function finishPublicationOrder(input: {
  f: PublicationFixture;
  order: PublicationOrder;
  edit: WriterOutcome | undefined;
}) {
  const { f, order, edit } = input;
  if (order === "photo-first") {
    assert.ok(edit);
    assert.equal(edit.applied, false);
    assert.ok(edit.error instanceof ConcurrentCaptureError);
    assert.equal(
      f.other.service.draftBuffer.merge(await f.other.service.read()).draft?.temperature,
      "37",
    );
    await f.other.service.draftBuffer.persist(f.other.service, f.draft.eventId);
    assert.equal((await f.store.read()).draft?.evidence.length, 1);
    assert.equal((await f.store.read()).draft?.temperature, "37");
  }
  if (order === "stale-save") {
    assert.ok(edit);
    assert.equal(edit.applied, false);
    assert.equal((await f.h.outbox.countByStatus()).pending, 0);
    const saved = await f.other.service.save(f.draft.eventId);
    assert.deepEqual(saved.event?.envelope.payload.evidence_ids, [EVIDENCE_ID]);
  }
  if (order === "revocation-first")
    assert.equal(
      (await f.h.db.query("SELECT generation FROM attachment_context"))[0]?.generation,
      2,
    );
}
async function assertPublicationOutcome(input: {
  f: PublicationFixture;
  order: PublicationOrder;
  result: PhotoOutcome;
  edit: WriterOutcome | undefined;
}) {
  const { f, order, result, edit } = input;
  const rejects = [
    "target-first",
    "revocation-first",
    "assignment-first",
    "shift-severe-first",
  ].includes(order);
  assert.equal(Boolean(result.error), rejects, order);
  assert.equal(result.value, !rejects, order);
  assert.equal(f.didIntercept(), true);
  const current = await f.store.read();
  assert.ok(current.draft);
  assert.equal(
    current.draft.point?.id,
    order === "target-first" ? f.secondPoint.id : f.draft.point?.id,
  );
  assert.equal(
    current.draft.temperature,
    ["target-first", "temperature-first"].includes(order) ? "37" : "",
  );
  assert.equal(current.draft.evidence.length, rejects ? 0 : 1);
  const [reference] = current.draft.evidence;
  if (reference) assert.deepEqual(Object.keys(reference).sort(), ["fileRef", "id"]);
  if (result.error) await refreshRejectedPublication(f, result.error);
  await finishPublicationOrder({ f, order, edit });
  const [file] = await f.h.db.query("SELECT metadata,state FROM attachment_file WHERE id=?", [
    EVIDENCE_ID,
  ]);
  assert.ok(file);
  assert.equal(file.state, "ready");
  assert.deepEqual(
    await readFile((JSON.parse(String(file.metadata)) as { fileRef: string }).fileRef),
    PNG_BYTES,
  );
  assert.equal(
    (await f.h.db.query("SELECT * FROM attachment_event")).length,
    order === "stale-save" ? 1 : 0,
  );
}
async function refreshRejectedPublication(f: PublicationFixture, error: unknown) {
  const states: Snapshot[] = [];
  const errors: unknown[] = [];
  await reportCaptureError(
    {
      refresh: async () => {
        states.push(await f.capture.service.read());
      },
      setError: (key) => {
        errors.push(key);
      },
    },
    error,
  );
  assert.equal(states.length, 1);
  assert.equal(errors.at(-1), "mobile.ovitrap.staleView");
  assert.deepEqual(states[0]?.draft, (await f.store.read()).draft);
}
void test("photo publication and public draft writers preserve both winner orders and original authority", async (test) => {
  for (const order of PUBLICATION_ORDERS) {
    await test.test(order, async (scenario) => {
      const f = await publicationFixture(scenario, order);
      const writer = await holdPublicWriter(f, order);
      const result = await f.capture.service.captureEvidence(f.draft.eventId).then(
        (value): PhotoOutcome => ({ value, error: null }),
        (error: unknown): PhotoOutcome => ({ value: false, error }),
      );
      f.release.resolve(undefined);
      await assertPublicationOutcome({ f, order, result, edit: await writer?.completion });
    });
  }
});

void test("a native continuation retains its original actor, session, live shift, scope and unsaved state", async (test) => {
  for (const change of ["actor", "session", "shift", "scope", "target", "saved"] as const) {
    const h = await attachmentHarness(test);
    const camera = deferred<{ id: string; fileRef: string }>();
    const opened = deferred<undefined>();
    const store = new OvitrapStore(h.db);
    const draft = makeDraft();
    let shiftId = draft.shiftId;
    const configuration = captureConfiguration({
      store,
      port: {
        capture: () => {
          opened.resolve(undefined);
          return camera.promise;
        },
      },
      attachments: { ...h, capture: new EvidenceCapture(h) },
    });
    const wired = await harness(h, { ...configuration, shiftId: () => Promise.resolve(shiftId) });
    await store.begin(draft);
    const pending = wired.service.captureEvidence(draft.eventId);
    await opened.promise;
    if (change === "actor")
      h.setIdentity({ owner: { ...OWNER, userId: "another-user" }, sessionId: "session-one" });
    if (change === "session") h.setIdentity({ owner: OWNER, sessionId: "replacement-session" });
    if (change === "shift") shiftId = "replacement-shift";
    if (change === "scope")
      await store.saveSnapshots({ ...(await store.snapshots()), assignment: null });
    if (change === "target")
      await store.update(
        { ...draft, ovitrapId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        (await store.read()).draftVersion,
      );
    if (change === "saved")
      await h.outbox.enqueue(
        captureEvent(draft),
        store.commitStatements(draft, (await store.read()).draftVersion),
      );
    camera.resolve({ id: EVIDENCE_ID, fileRef: h.source });
    await assert.rejects(pending);
    assert.deepEqual(await h.db.query("SELECT id FROM attachment_file"), [], change);
    assert.deepEqual((await store.read()).draft?.evidence, [], change);
  }
});

void test("retiring a capture during a real file read stops publication and writes while retaining ambiguous bytes", async (test) => {
  const h = await attachmentHarness(test);
  const read = deferred<undefined>();
  const resume = deferred<undefined>();
  const controller = new AbortController();
  let firstRead = true;
  let writes = 0;
  let fileRef = "";
  let closed = 0;
  const files = {
    ...h.files,
    openRead: async (ref: string) => {
      const reader = await h.files.openRead(ref);
      return {
        close: () => reader.close(),
        read: async (length: number) => {
          const bytes = await reader.read(length);
          if (firstRead) {
            firstRead = false;
            read.resolve(undefined);
            await resume.promise;
          }
          return bytes;
        },
      };
    },
    createExclusive: async (id: string) => {
      const target = await h.files.createExclusive(id);
      fileRef = target.ref;
      return {
        ref: target.ref,
        writer: {
          write: (bytes: Uint8Array) => {
            writes++;
            return target.writer.write(bytes);
          },
          close: () => {
            closed++;
            return target.writer.close();
          },
        },
      };
    },
  };
  const store = new OvitrapStore(h.db);
  const wired = await harness(
    h,
    captureConfiguration({
      store,
      port: { capture: () => Promise.resolve({ id: EVIDENCE_ID, fileRef: h.source }) },
      attachments: { ...h, capture: new EvidenceCapture({ ...h, files }) },
    }),
  );
  const draft = makeDraft();
  await store.begin(draft);
  const pending = wired.service.captureEvidence(draft.eventId, controller.signal);
  await read.promise;
  controller.abort();
  resume.resolve(undefined);
  await assert.rejects(pending, /stale_context/);
  assert.equal(writes, 0);
  assert.equal(closed, 1);
  assert.equal((await readFile(fileRef)).length, 0);
  assert.deepEqual((await store.read()).draft?.evidence, []);
  const [row] = await h.db.query("SELECT metadata,last_error FROM attachment_file");
  assert.equal(row?.metadata, null);
  assert.equal(row.last_error, "stale_context");
});

void test("login versus adopted-only reserve is arbitrated atomically in either order", async () => {
  const local = await createStores();
  const store = new AttachmentStore(local.db);
  const fence = await store.bindSession({ owner: OWNER, sessionId: "old-session" });
  assert.ok(fence);
  const identity = {
    db: local.db,
    deviceId: OWNER.deviceId,
    credentials: {
      ...EMPTY_CREDENTIALS,
      origin: OWNER.issuer,
      sessionId: "new-session",
      pair: { access: "test-access", refresh: "test-refresh" },
    },
    profile: {
      username: "same-name",
      firstName: "Test",
      userId: "different-user",
      sessionId: "new-session",
      issuer: OWNER.issuer,
      organization: {
        id: OWNER.organizationId,
        slug: "test",
        name: "Test",
        country: "MX",
        timezone: "America/Mexico_City",
        languages: ["es-MX"],
        epi_week: "iso" as const,
        label_phone: "",
        support_contact: "",
        logo_url: null,
      },
      permissions: [],
    },
  };
  await store.reserve({ id: ID, draftId: "draft", fence });
  assert.equal(await prepareEvidenceSession(identity), false);
  assert.equal(await store.isCurrent(fence), true);
  const empty = await createStores();
  const emptyStore = new AttachmentStore(empty.db);
  const old = await emptyStore.bindSession({ owner: OWNER, sessionId: "old-session" });
  assert.ok(old);
  assert.equal(await prepareEvidenceSession({ ...identity, db: empty.db }), true);
  await assert.rejects(
    () => emptyStore.reserve({ id: ID, draftId: "draft", fence: old }),
    /stale_context/,
  );
  assert.equal((await empty.db.query("SELECT id FROM attachment_file")).length, 0);
});
