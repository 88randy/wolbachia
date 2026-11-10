import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createApiClient } from "@wolbachia/api-client";
import { ReleaseService } from "../src/features/releases/service.ts";
import { ReleaseStore } from "../src/features/releases/store.ts";
import { canSaveRelease } from "../src/features/releases/domain.ts";
import { ReleaseError } from "../src/features/releases/types.ts";
import type { ReleaseSelection } from "../src/features/releases/types.ts";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { EvidenceSession } from "../src/attachments/evidence-session.ts";
import { EvidenceCapture } from "../src/attachments/capture-evidence.ts";
import { AttachmentSync } from "../src/attachments/attachment-sync.ts";
import type { AttachmentTransport } from "../src/attachments/attachment-transport.ts";
import type { EvidencePort, GpsPort } from "../src/features/ovitrap-check/types.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { DayStore } from "../src/features/day/store.ts";
import { KvStore, setStatement } from "../src/db/kv-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import type { SqlExecutor } from "../src/db/sql.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import type { SyncBatchRequest } from "../src/sync/sync-transport.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { makeEnvelope } from "./support/factories.ts";
import { nodePrivateFiles, PNG_BYTES } from "./support/attachment-fixtures.ts";
import { deferred } from "./support/auth-fakes.ts";
import { answer } from "./support/scripted-transport.ts";
import {
  PROJECTION_IDENTITY,
  projectionBundle,
  projectionChanges,
} from "./support/lifecycle-projection-fixtures.ts";
import {
  QUADRANT_REFERENCE,
  REVIEW_HISTORY,
  historyChange,
} from "./support/lifecycle-contract-fixtures.ts";
import { RELEASE_IDS, RELEASE_NOW, releasePins } from "./support/release-fixtures.ts";

const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const SHIFT_KEY = "release_test_shift";
const SELECTION: ReleaseSelection = {
  taskId: RELEASE_IDS.task,
  deviceId: RELEASE_IDS.device,
  manualCapture: false,
};
const PROFILE = {
  issuer: PROJECTION_IDENTITY.owner.issuer,
  sessionId: PROJECTION_IDENTITY.sessionId,
  userId: PROJECTION_IDENTITY.owner.userId,
  organization: { id: PROJECTION_IDENTITY.owner.organizationId },
  permissions: ["field_event.sync", "field.bootstrap", "field.upload"],
};

function downloadedBundle() {
  const base = projectionBundle(),
    pins = releasePins();
  const first = { ...pins.task, courier_id: PROJECTION_IDENTITY.owner.userId };
  const second = { ...first, id: id(91), point_id: id(92) };
  const capture = {
    as_of: "2026-11-09T15:00:00Z",
    version: "release-capture-v1",
    devices: [pins.device],
    tasks: [first, second],
  };
  const assignments = capture.tasks.map((task) => ({
    kind: "task",
    id: task.id,
    code: `RELEASE-${task.id}`,
    point: task.point_id,
    quadrant_id: pins.permit.quadrant_id,
    courier: task.courier_id,
    revision: task.owner_revision,
    action: "release",
    date: task.due_date,
    is_completed: false,
    category: null,
    source: null,
    protocol: null,
    target: 1,
  }));
  return {
    ...base,
    assignments,
    permits: [{ ...pins.permit, capture }],
    eligibility: [
      {
        ...pins.eligibility,
        subject_id: PROJECTION_IDENTITY.owner.userId,
        organization_id: PROJECTION_IDENTITY.owner.organizationId,
      },
    ],
    capture_context: {
      ...base.capture_context,
      grants: [
        {
          centers: { mode: "selected", ids: [pins.permit.center_id] },
          quadrants: { mode: "selected", ids: [pins.permit.quadrant_id] },
        },
      ],
    },
    quadrants: [
      {
        ...QUADRANT_REFERENCE,
        id: pins.permit.quadrant_id,
        quadrant_id: pins.permit.quadrant_id,
        center_id: pins.permit.center_id,
        is_closed: false,
        closure_id: null,
      },
    ],
    sampling_points: [],
    ovitraps: [],
  };
}
function uploadTransport(uploaded: string[]): AttachmentTransport {
  const grant = { lease: "fixture-lease", contentType: "image/png" as const };
  return {
    authorize: () => Promise.resolve({ state: "authorized", verifiedAt: null, grant }),
    renew: () => Promise.resolve({ state: "authorized", verifiedAt: null, grant }),
    put: (call, bytes) => {
      assert.deepEqual(Buffer.from(bytes), PNG_BYTES);
      uploaded.push(call.file.id);
      return Promise.resolve();
    },
    finalize: () => Promise.resolve(RELEASE_NOW.toISOString()),
  };
}
function offlineEngine(
  stores: { outbox: OutboxRepository; kv: KvStore },
  requests: SyncBatchRequest[],
) {
  return new SyncEngine({
    pass: {
      ...stores,
      deviceId: PROJECTION_IDENTITY.owner.deviceId,
      now: () => RELEASE_NOW,
      transport: (request) => {
        requests.push(request);
        return Promise.resolve(answer([]));
      },
    },
    hasSession: () => false,
    hasPendingFinalUpload: () => Promise.resolve(false),
    hasServer: () => true,
    random: () => 0,
    schedule: () => () => undefined,
    report: (error) => {
      throw error;
    },
  });
}
async function harness(context: TestContext) {
  const results = fileURLToPath(new URL("../../test-results/", import.meta.url));
  await mkdir(results, { recursive: true });
  const directory = await mkdtemp(join(results, "m-10-139-")),
    owned = join(directory, "owned"),
    source = join(directory, "source.png");
  await mkdir(owned);
  await writeFile(source, PNG_BYTES);
  let database = await openTestDatabase(join(directory, "phone.sqlite"));
  context.after(async () => {
    database.close();
    assert.ok(
      resolve(directory).startsWith(resolve(results) + "/") ||
        resolve(directory).startsWith(resolve(results) + "\\"),
    );
    await rm(directory, { recursive: true });
  });
  let body = downloadedBundle(),
    clock = RELEASE_NOW,
    uuid = 200,
    photoId = 500,
    gpsCalls = 0,
    canCapture = true;
  let camera: EvidencePort["capture"] = () =>
    Promise.resolve({ id: id(++photoId), fileRef: pathToFileURL(source).href });
  let gps: GpsPort["locate"] = () => {
    gpsCalls += 1;
    return Promise.resolve({ lat: 19, lng: -99, accuracy_m: gpsCalls + 2 });
  };
  const requests: SyncBatchRequest[] = [],
    uploaded: string[] = [],
    files = nodePrivateFiles(owned);
  const compose = (db: SqlExecutor) => {
    const store = new ReleaseStore(db),
      attachmentStore = new AttachmentStore(db);
    const session = new EvidenceSession({
      store: attachmentStore,
      current: () => PROJECTION_IDENTITY,
      isFinal: () => false,
    });
    const attachments = {
      store: attachmentStore,
      session,
      capture: new EvidenceCapture({ store: attachmentStore, session, files }),
      sync: new AttachmentSync({
        store: attachmentStore,
        session,
        files,
        now: () => clock,
        transport: uploadTransport(uploaded),
      }),
    };
    const bundle = new DayBundleService({
      store: new DayStore(db),
      now: () => clock,
      getCaptureIdentity: () => PROJECTION_IDENTITY,
      transport: () => Promise.resolve({ kind: "bundle", body }),
    });
    const outbox = new OutboxRepository(db, () => clock),
      kv = new KvStore(db),
      engine = offlineEngine({ outbox, kv }, requests);
    const service = new ReleaseService({
      store,
      attachments,
      bundle,
      engine,
      current: () => PROJECTION_IDENTITY,
      canCapture: () => canCapture,
      shift: async () => {
        const [row] = await db.query("SELECT value FROM kv WHERE key=?", [SHIFT_KEY]);
        if (!row) throw new ReleaseError("shift");
        return {
          id: RELEASE_IDS.shift,
          guard: {
            sql: "SELECT 1 FROM kv WHERE key=? AND value=?",
            params: [SHIFT_KEY, String(row.value)],
          },
        };
      },
      timezone: () => "America/Mexico_City",
      photo: { capture: (capture) => camera(capture) },
      gps: { locate: () => gps() },
      uuid: () => id(++uuid),
      now: () => clock,
    });
    return { db, store, attachments, bundle, outbox, kv, engine, service };
  };
  const local = compose(database.executor);
  await local.db.runAtomically([
    setStatement("session_profile", JSON.stringify(PROFILE)),
    setStatement(SHIFT_KEY, RELEASE_IDS.shift),
    setStatement("shift_open_catalog", JSON.stringify({ version: "catalog-release-139" })),
    setStatement("shift_open_rules", JSON.stringify({ version: "rules-release-139" })),
  ]);
  await local.bundle.refresh();
  return {
    ...local,
    requests,
    uploaded,
    source,
    gpsCalls: () => gpsCalls,
    setClock: (now: Date) => {
      clock = now;
    },
    setUnlocked: (allowed: boolean) => {
      canCapture = allowed;
    },
    setCamera: (next: EvidencePort["capture"]) => {
      camera = next;
    },
    setGps: (next: GpsPort["locate"]) => {
      gps = next;
    },
    setBundle: (next: typeof body) => {
      body = next;
    },
    reopen: async () => {
      await local.engine.requestSync();
      database.close();
      database = await openTestDatabase(join(directory, "phone.sqlite"));
      return compose(database.executor);
    },
  };
}
async function prepared(
  h: Awaited<ReturnType<typeof harness>>,
  selection = SELECTION,
  quantity = "2.500000",
) {
  const eventId = await h.service.begin(selection);
  await h.service.edit(eventId, quantity);
  await h.service.photo(eventId, () => true);
  await h.service.locate(eventId, () => true);
  return eventId;
}

void test("M10 offline save enrolls real adopted evidence, restarts and retries the original UUID before a critical suspension rejection", async (t) => {
  const h = await harness(t),
    eventId = await prepared(h);
  const before = await h.service.read(SELECTION);
  assert.equal(canSaveRelease(before.gates), true);
  assert.ok(before.draft?.evidence[0]);
  h.setClock(new Date("2026-11-09T16:01:00Z"));
  await h.service.save(eventId);
  const saved = await h.service.read(SELECTION);
  assert.ok(saved.event?.envelope.gps);
  assert.equal(h.requests.length, 0);
  assert.equal(saved.event.status, "pending");
  assert.equal(saved.evidencePending, true);
  assert.equal(saved.event.envelope.gps.accuracy_m, 4);
  assert.equal(saved.event.envelope.device_time, "2026-11-09T16:01:00.000Z");
  assert.equal(h.gpsCalls(), 2);
  assert.deepEqual(await readFile(before.draft.evidence[0].fileRef), PNG_BYTES);
  assert.deepEqual(
    (await h.db.query("SELECT evidence_id,event_id FROM attachment_event")).map((row) => [
      row.evidence_id,
      row.event_id,
    ]),
    [[before.draft.evidence[0].id, eventId]],
  );
  const reopened = await h.reopen(),
    requests: SyncBatchRequest[] = [],
    serverIds = new Set<string>();
  let releaseRequests = 0;
  const client = createApiClient({
    baseUrl: PROJECTION_IDENTITY.owner.issuer,
    auth: { kind: "bearer", getAccessToken: () => undefined },
    fetch: async (request) => {
      const body = (await request.json()) as SyncBatchRequest;
      requests.push(body);
      if (!body.events.length) {
        const empty = answer([]);
        assert.ok(empty.ok);
        return Response.json(empty.response);
      }
      for (const event of body.events) serverIds.add(event.id);
      if (++releaseRequests === 1)
        throw new Error("Lost acknowledgement after scripted source retention");
      const response = answer(
        body.events.map((event) => ({
          id: event.id,
          status: "rejected",
          code: "release_permit_suspended",
          params: {},
        })),
      );
      assert.ok(response.ok);
      return Response.json(response.response);
    },
  });
  const pass = {
    outbox: reopened.outbox,
    kv: reopened.kv,
    deviceId: PROJECTION_IDENTITY.owner.deviceId,
    now: () => RELEASE_NOW,
    transport: createSyncTransport(client),
    attachments: {
      selection: reopened.attachments.session.selection,
      recoverInterrupted: () => Promise.resolve(),
      advanceOne: () => reopened.attachments.sync.advanceOne(),
      nextRetryDelayMs: reopened.attachments.sync.nextRetryDelayMs,
    },
  };
  assert.equal((await runSyncPass(pass, { batchSize: 50 })).kind, "retry");
  assert.equal((await reopened.service.read(SELECTION)).event?.status, "pending");
  await runSyncPass(pass, { batchSize: 50 });
  const rejected = await reopened.service.read(SELECTION);
  assert.ok(rejected.event?.result);
  assert.equal(rejected.event.status, "rejected");
  assert.equal(rejected.event.result.code, "release_permit_suspended");
  assert.deepEqual(rejected.event.envelope, saved.event.envelope);
  assert.deepEqual(rejected.draft, saved.draft);
  assert.ok(rejected.draft?.assessment);
  assert.equal(rejected.draft.assessment.rulesVersion, rejected.draft.rulesVersion);
  assert.ok(rejected.draft.assessment.gates.every(({ state }) => state === "pass"));
  assert.deepEqual(
    requests.filter(({ events }) => events.length).map(({ events }) => events),
    [[saved.event.envelope], [saved.event.envelope]],
  );
  assert.deepEqual([...serverIds], [eventId]);
  assert.deepEqual(h.uploaded, [before.draft.evidence[0].id]);
  await assert.rejects(reopened.service.save(eventId));
  assert.equal(
    (await reopened.db.query("SELECT id FROM outbox_event WHERE type='release.record'")).length,
    1,
  );
  assert.deepEqual(await readFile(before.draft.evidence[0].fileRef), PNG_BYTES);
});

void test("M10 a profile change while the camera is open preserves the raw draft without adopting or saving a stale photo", async (t) => {
  const h = await harness(t),
    eventId = await h.service.begin(SELECTION);
  await h.service.edit(eventId, "7.250000");
  const entered = deferred<undefined>(),
    captured = deferred<Awaited<ReturnType<EvidencePort["capture"]>>>();
  h.setCamera(() => {
    entered.resolve(undefined);
    return captured.promise;
  });
  const photo = h.service.photo(eventId, () => true);
  await entered.promise;
  await h.db.runAtomically([
    setStatement("session_profile", JSON.stringify({ ...PROFILE, permissions: [] })),
  ]);
  captured.resolve({ id: id(700), fileRef: pathToFileURL(h.source).href });
  await assert.rejects(photo);
  const retained = await h.service.read(SELECTION);
  assert.ok(retained.draft);
  assert.equal(retained.draft.quantity, "7.250000");
  assert.deepEqual(retained.draft.evidence, []);
  assert.equal(retained.event, null);
  assert.equal(retained.ready, false);
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 0);
  assert.equal((await h.db.query("SELECT id FROM outbox_event")).length, 0);
});

void test("M10 two tasks cannot locally reserve more than the same genuine received custody", async (t) => {
  const h = await harness(t),
    first = await prepared(h, SELECTION, "7");
  await h.service.save(first);
  const secondSelection = { ...SELECTION, taskId: id(91) },
    second = await prepared(h, secondSelection, "4");
  const before = await h.service.read(secondSelection);
  assert.equal(canSaveRelease(before.gates), false);
  await assert.rejects(h.service.save(second));
  const retained = await h.service.read(secondSelection);
  assert.equal(retained.draft?.quantity, "4");
  assert.equal(retained.event, null);
  assert.equal(
    (await h.db.query("SELECT id FROM outbox_event WHERE type='release.record'")).length,
    1,
  );
  await h.service.edit(second, "3");
  await h.service.save(second);
  assert.equal(
    (await h.db.query("SELECT id FROM outbox_event WHERE type='release.record'")).length,
    2,
  );
});

void test("M10 a genuine accounted source releases only its already debited local reservation without rewriting the original review status", async (t) => {
  const h = await harness(t),
    first = await prepared(h, SELECTION, "2");
  await h.service.save(first);
  await h.engine.requestSync();
  assert.equal(await h.attachments.sync.advanceOne(), true);
  await h.outbox.claimPending(1, await h.attachments.session.selection());
  await h.outbox.settle([
    {
      id: first,
      action: "review",
      result: { code: "release_transit_review_required", params: {} },
    },
  ]);
  const body = downloadedBundle(),
    permit = body.permits[0];
  assert.ok(permit);
  const device = permit.capture.devices[0];
  assert.ok(device);
  const custody = device.custody[0];
  assert.ok(custody);
  h.setBundle({
    ...body,
    assignments: body.assignments.map((task) =>
      task.id === SELECTION.taskId ? { ...task, is_completed: true } : task,
    ),
    permits: [
      {
        ...permit,
        capture: {
          ...permit.capture,
          version: "actual-release-debit-v2",
          tasks: permit.capture.tasks.map((task) =>
            task.id === SELECTION.taskId ? { ...task, is_completed: true } : task,
          ),
          devices: [
            {
              ...device,
              custody: [
                {
                  ...custody,
                  available_quantity: "8.000000",
                  accounted_release_event_ids: [first],
                },
              ],
            },
          ],
        },
      },
    ],
  });
  await h.bundle.refresh(true);
  const secondSelection = { ...SELECTION, taskId: id(91) },
    second = await prepared(h, secondSelection, "8");
  const fresh = await h.service.read(secondSelection);
  assert.equal(canSaveRelease(fresh.gates), true, JSON.stringify(fresh.gates));
  await h.service.save(second);
  assert.equal((await h.service.read(SELECTION)).event?.status, "in_review");
  assert.equal((await h.service.read(secondSelection)).event?.status, "pending");
});

void test("M10 an already launched camera may finish privately under local lock while a new launch is refused", async (t) => {
  const h = await harness(t),
    eventId = await h.service.begin(SELECTION);
  await h.service.edit(eventId, "3.125000");
  const entered = deferred<undefined>(),
    captured = deferred<Awaited<ReturnType<EvidencePort["capture"]>>>();
  let launches = 0;
  h.setCamera(() => {
    launches += 1;
    entered.resolve(undefined);
    return captured.promise;
  });
  const photo = h.service.photo(eventId, () => true);
  await entered.promise;
  h.setUnlocked(false);
  captured.resolve({ id: id(710), fileRef: pathToFileURL(h.source).href });
  await photo;
  await assert.rejects(h.service.photo(eventId, () => true));
  assert.equal(launches, 1);
  assert.equal((await h.service.read(SELECTION)).draft, null);
  h.setUnlocked(true);
  const restored = await h.service.read(SELECTION);
  assert.ok(restored.draft?.evidence[0]);
  assert.equal(restored.draft.quantity, "3.125000");
  assert.equal(restored.event, null);
  assert.deepEqual(await readFile(restored.draft.evidence[0].fileRef), PNG_BYTES);
});

void test("M10 a saved source retains exact latest review feedback after its shift closes without rewriting ingestion", async (t) => {
  const h = await harness(t),
    eventId = await prepared(h);
  await h.service.save(eventId);
  await h.engine.requestSync();
  await h.attachments.sync.advanceOne();
  await h.outbox.claimPending(1, await h.attachments.session.selection());
  await h.outbox.settle([
    {
      id: eventId,
      action: "review",
      result: { code: "release_transit_review_required", params: {} },
    },
  ]);
  const original = await h.service.read(SELECTION);
  assert.equal(original.event?.status, "in_review");
  const latest = {
    ...REVIEW_HISTORY,
    id: id(720),
    source_event_id: eventId,
    revision: 3,
    source_code: "release_transit_review_required",
    effect_state: "applied_review",
    subjects: [{ center_id: RELEASE_IDS.center, quadrant_id: RELEASE_IDS.quadrant }],
  };
  const unrelated = { ...latest, id: id(721), source_event_id: id(722), revision: 99 };
  const older = { ...latest, id: id(723), revision: 1 };
  await h.db.runAtomically([{ sql: "DELETE FROM kv WHERE key=?", params: [SHIFT_KEY] }]);
  await h.bundle.applyProjectionChanges(
    projectionChanges({
      capture_context: downloadedBundle().capture_context,
      history: [
        { ...historyChange(latest), sequence: 20 },
        { ...historyChange(unrelated), sequence: 21 },
        { ...historyChange(older), sequence: 22 },
      ],
    }),
  );
  const received = await h.service.read(SELECTION);
  assert.equal(received.review?.id, latest.id);
  assert.equal(received.review.effect_state, "applied_review");
  assert.deepEqual(received.draft, original.draft);
  assert.deepEqual(received.event, original.event);
});

void test("M10 opening and release predecessors hold only close transport while local work and future retries remain durable", async (t) => {
  const h = await harness(t);
  const opening = makeEnvelope({ id: id(730), type: "shift.open", shift_id: RELEASE_IDS.shift });
  const close = makeEnvelope({ id: id(731), type: "shift.close", shift_id: RELEASE_IDS.shift });
  await h.outbox.enqueue(opening);
  const release = await prepared(h);
  await h.service.save(release);
  await h.engine.requestSync();
  await h.outbox.enqueue(close);
  const selection = await h.attachments.session.selection();
  await h.db.runAtomically([
    {
      sql: "UPDATE outbox_event SET retry_at=? WHERE id=?",
      params: ["2026-11-09T17:00:00Z", opening.id],
    },
  ]);
  assert.equal((await h.db.query("SELECT id FROM outbox_event")).length, 3);
  assert.deepEqual(await h.outbox.claimPending(50, selection), []);
  await h.db.runAtomically([
    { sql: "UPDATE outbox_event SET retry_at=NULL WHERE id=?", params: [opening.id] },
  ]);
  assert.deepEqual(
    (await h.outbox.claimPending(50, selection)).map(({ envelope }) => envelope.id),
    [opening.id],
  );
  await h.outbox.settle([
    { id: opening.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  assert.deepEqual(await h.outbox.claimPending(50, selection), []);
  await h.db.runAtomically([
    {
      sql: "UPDATE outbox_event SET retry_at=? WHERE id=?",
      params: ["2026-11-09T17:00:00Z", release],
    },
  ]);
  assert.equal(await h.attachments.sync.advanceOne(), true);
  assert.deepEqual(
    await h.outbox.claimPending(50, selection),
    [],
    "future release retry still prevents close from overtaking it",
  );
  await h.db.runAtomically([
    { sql: "UPDATE outbox_event SET retry_at=NULL WHERE id=?", params: [release] },
  ]);
  assert.deepEqual(
    (await h.outbox.claimPending(50, selection)).map(({ envelope }) => envelope.id),
    [release],
  );
  await h.outbox.settle([
    {
      id: release,
      action: "review",
      result: { code: "release_transit_review_required", params: {} },
    },
  ]);
  assert.deepEqual(
    (await h.outbox.claimPending(50, selection)).map(({ envelope }) => envelope.id),
    [close.id],
  );
});
