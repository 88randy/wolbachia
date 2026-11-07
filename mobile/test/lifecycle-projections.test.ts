import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { migrate } from "../src/db/migrations.ts";
import { KvStore } from "../src/db/kv-store.ts";
import type { SqlExecutor } from "../src/db/sql.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { lifecycleEvent } from "../src/features/ovitrap-lifecycle/events.ts";
import { LifecycleStore } from "../src/features/ovitrap-lifecycle/store.ts";
import { LifecycleService } from "../src/features/ovitrap-lifecycle/service.ts";
import { startOwnedLifecycleDraft } from "../src/features/ovitrap-lifecycle/new-owned-draft.ts";
import { startDraft } from "../src/features/ovitrap-lifecycle/new-draft.ts";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import type {
  LifecycleSourceTurn,
  CurrentLifecycleDraft,
} from "../src/features/ovitrap-lifecycle/types.ts";
import { readHistoryChange } from "../src/features/ovitrap-lifecycle/history-contract.ts";
import { retainedProposal } from "../src/features/ovitrap-lifecycle/retained-proposal.ts";
import { capturePointScopeSql } from "../src/features/ovitrap-lifecycle/context-sql.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { RemoteSessionEnded } from "../src/auth/session-requests.ts";
import { accepted, answer, httpFailure } from "./support/scripted-transport.ts";
import { makeEnvelope } from "./support/factories.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import {
  CAPTURE_CONTEXT,
  CONTRACT_IDS,
  historyChange,
  REVIEW_HISTORY,
  SHIFT_HISTORY,
  TRANSFER_HISTORY,
  QUADRANT_REFERENCE,
  RELOCATION_HISTORY,
} from "./support/lifecycle-contract-fixtures.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_TRAP,
  PROJECTION_NOW,
  projectionBundle,
  projectionChanges,
  quadrantChange,
  projectionDraft,
} from "./support/lifecycle-projection-fixtures.ts";

void test("C3/C4: schema14 recovery requires a complete owned body across 304, failure and cold reopen", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "m09-readiness-"));
  const path = join(directory, "synthetic.sqlite");
  let local = await openTestDatabase(path, 14);
  t.after(async () => {
    local.close();
    await rm(directory, { recursive: true, force: true });
  });
  await local.executor.runAtomically([
    {
      sql: "INSERT INTO day_bundle_meta(slot,payload) VALUES(1,?)",
      params: [JSON.stringify({ bundle_version: "old-etag" })],
    },
    { sql: "INSERT INTO kv(key,value) VALUES('sync_cursor','old-cursor')" },
  ]);
  const legacyDraft = projectionDraft(CONTRACT_IDS.device);
  await new LifecycleStore(local.executor).begin(legacyDraft, null);
  const legacyBytes = await local.executor.query("SELECT draft FROM lifecycle_draft");
  local.close();
  local = await openTestDatabase(path);
  let store = new DayStore(local.executor);
  assert.equal(
    await store.needsBootstrap(),
    true,
    "an old valid cursor is not new-consumer readiness",
  );
  const etags: (string | null)[] = [];
  let result: "304" | "offline" | "body" = "304";
  const bundle = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: (etag) => {
      etags.push(etag);
      if (result === "offline") return Promise.reject(new Error("offline"));
      return Promise.resolve(
        result === "304" ? { kind: "unchanged" } : { kind: "bundle", body: projectionBundle() },
      );
    },
  });
  await assert.rejects(bundle.refresh(), /requires a body/);
  result = "offline";
  await assert.rejects(bundle.refresh(), /offline/);
  assert.deepEqual(etags, [null, null]);
  assert.equal(await store.needsBootstrap(), true);
  await bundle.applyProjectionChanges(projectionChanges());
  assert.equal(await store.needsBootstrap(), true, "initial changes are not hydration");
  const before = await local.executor.query("SELECT * FROM kv ORDER BY key");
  const failingStore = new DayStore({
    query: (sql, params) => local.executor.query(sql, params),
    runAtomically: () => Promise.reject(new Error("full write failed")),
  });
  const failing = new DayBundleService({
    store: failingStore,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: projectionBundle() }),
  });
  await assert.rejects(failing.refresh(), /full write failed/);
  assert.deepEqual(await local.executor.query("SELECT * FROM kv ORDER BY key"), before);
  await assert.rejects(
    store.replace({ ...projectionBundle(), history: [{ kind: "invented" }] }, PROJECTION_NOW),
  );
  assert.equal(await store.needsBootstrap(), true);
  result = "body";
  await bundle.refresh();
  await assert.rejects(
    new OutboxRepository(local.executor, () => PROJECTION_NOW).enqueue(
      lifecycleEvent(legacyDraft),
      new LifecycleStore(local.executor).commitStatements(legacyDraft),
    ),
    /could not be saved/,
  );
  assert.deepEqual(await local.executor.query("SELECT draft FROM lifecycle_draft"), legacyBytes);
  assert.deepEqual(
    await local.executor.query(
      "SELECT * FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-draft'",
    ),
    [],
  );
  const freshDraft = await prepareProjectionCapture(local.executor);
  const lifecycle = new LifecycleStore(local.executor);
  const originalOrigin = await local.executor.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-draft'",
  );
  await lifecycle.begin(legacyDraft, freshDraft.eventId); // Delayed restore over a DIFFERENT current UUID must not adopt it.
  await assert.rejects(
    new OutboxRepository(local.executor, () => PROJECTION_NOW).enqueue(
      lifecycleEvent(legacyDraft),
      lifecycle.commitStatements(legacyDraft),
    ),
    /could not be saved/,
  );
  const currentHandle = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  assert.ok(currentHandle);
  const reusedTurn = await projectionStartTurn(local.executor);
  await assert.rejects(
    startOwnedLifecycleDraft({
      store: lifecycle,
      handle: currentHandle,
      ownerFence: reusedTurn.ownerFence,
      admit: reusedTurn.write,
      expectedEventId: legacyDraft.eventId,
      uuid: () => legacyDraft.eventId,
      create: (id) => currentProjectionDraft(local.executor, reusedTurn, id),
    }),
    /CHECK constraint/,
  );
  assert.deepEqual(
    await local.executor.query(
      "SELECT body FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-draft'",
    ),
    originalOrigin,
  );
  await lifecycle.begin(freshDraft, legacyDraft.eventId); // Proven original may be restored, never resealed.
  const copiedUuid = { ...legacyDraft, eventId: freshDraft.eventId };
  await lifecycle.begin(copiedUuid, freshDraft.eventId);
  const copiedBefore = await local.executor.query("SELECT draft FROM lifecycle_draft");
  const copiedTurn = await projectionStartTurn(local.executor);
  assert.equal(
    (await lifecycle.readOwned(copiedTurn)).recovery,
    "blocked_ownership",
    "restored legacy JSON cannot acquire a new v2 origin by copying its UUID",
  );
  assert.deepEqual(await local.executor.query("SELECT draft FROM lifecycle_draft"), copiedBefore);
  await lifecycle.begin(freshDraft, freshDraft.eventId);
  assert.equal(await store.needsBootstrap(), false);
  local.close();
  local = await openTestDatabase(path);
  store = new DayStore(local.executor);
  assert.equal(await store.needsBootstrap(), false);
  const [state] = await local.executor.query(
    "SELECT value FROM kv WHERE key='lifecycle_capture_context'",
  );
  assert.equal(
    (JSON.parse(String(state?.value)) as { owner: { userId: string } }).owner.userId,
    PROJECTION_IDENTITY.owner.userId,
  );
  const configuration = new OvitrapStore(local.executor);
  await configuration.publishSnapshots(
    { catalog: null, rules: null, assignment: null },
    await configuration.assignmentAuthority(),
  );
  assert.equal(await new KvStore(local.executor).get("lifecycle_bootstrap_pending"), "false");
  assert.equal(
    await store.needsBootstrap(),
    true,
    "a stale durable binding cannot reuse a cleared flag",
  );
  const fresh = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: (etag) => {
      assert.equal(etag, null);
      return Promise.resolve({ kind: "bundle", body: projectionBundle() });
    },
  });
  await fresh.refresh();
  const handle = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  const empty = {
    ...projectionBundle(),
    history: [],
    quadrants: [],
    sampling_points: [],
    ovitraps: [],
    capture_context: { ...projectionBundle().capture_context, grants: [] },
  };
  await store.replace(empty, PROJECTION_NOW, handle);
  assert.equal(
    await store.needsBootstrap(),
    false,
    "valid empty input is known denial, not endless bootstrap",
  );
  await assert.rejects(saveProjectionCapture(local.executor), /could not be saved/);
  await invalidCursorReadiness(directory);
});

async function invalidCursorReadiness(directory: string) {
  const path = join(directory, "invalid-cursor.sqlite");
  let local = await openTestDatabase(path);
  try {
    let store = new DayStore(local.executor);
    let mode: "body" | "offline" | "hold" | "304" = "body";
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    const etags: (string | null)[] = [];
    const transport = async (etag: string | null) => {
      etags.push(etag);
      if (mode === "hold") {
        entered();
        await resume;
        throw new Error("recovery offline");
      }
      if (mode === "offline") throw new Error("ordinary offline");
      return mode === "304"
        ? { kind: "unchanged" as const }
        : { kind: "bundle" as const, body: projectionBundle() };
    };
    const service = () =>
      new DayBundleService({
        store,
        now: () => PROJECTION_NOW,
        getCaptureIdentity: () => PROJECTION_IDENTITY,
        transport,
      });
    let bundle = service();
    await bundle.refresh();
    const capture = new OvitrapStore(local.executor);
    await capture.publishSnapshots(
      { ...(await capture.snapshots()), assignment: projectionDraft().assignment },
      await capture.assignmentAuthority(),
    );
    await bundle.refresh();
    await saveProjectionCapture(local.executor);
    const draft = await prepareProjectionCapture(local.executor, CONTRACT_IDS.actor);
    const turn = await projectionStartTurn(local.executor);
    const kept = () => recoveryFacts(local.executor);
    const before = await kept();
    const cursor = await new KvStore(local.executor).get("sync_cursor");
    mode = "offline";
    await assert.rejects(bundle.refresh(), /ordinary offline/);
    assert.equal(await store.needsBootstrap(), false, "ordinary offline is not known scope loss");
    await turn.assertCurrent();
    assert.deepEqual(await kept(), before);
    const outbox = new OutboxRepository(local.executor, () => PROJECTION_NOW);
    mode = "hold";
    const pending = runSyncPass(
      {
        outbox,
        kv: new KvStore(local.executor),
        ...bundle.syncHooks(),
        deviceId: CONTRACT_IDS.device,
        now: () => PROJECTION_NOW,
        transport: () => Promise.resolve(httpFailure(400, "invalid_cursor")),
      },
      { batchSize: 50 },
    ).then(
      (value) => ({ value, error: null }),
      (error: unknown) => ({ value: null, error }),
    );
    await waiting;
    try {
      assert.equal(
        await store.needsBootstrap(),
        true,
        "known invalid cursor must suspend ready authority BEFORE recovery HTTP completes",
      );
      await assert.rejects(
        outbox.enqueue(
          lifecycleEvent(draft),
          new LifecycleStore(local.executor).commitStatements(draft),
        ),
        /could not be saved/,
      );
      await assert.rejects(
        new LifecycleStore(local.executor).saveConfiguration({ catalog: null, rules: null }, turn),
        /stale|changed/i,
      );
      assert.deepEqual(await kept(), before);
      assert.equal(await new KvStore(local.executor).get("sync_cursor"), cursor);
    } finally {
      release();
      await pending;
    }
    assert.match(String((await pending).error), /recovery offline/);
    local.close();
    local = await openTestDatabase(path);
    store = new DayStore(local.executor);
    bundle = service();
    assert.equal(await store.needsBootstrap(), true, "reopen retains suspended readiness");
    assert.deepEqual(await kept(), before);
    mode = "304";
    await assert.rejects(bundle.refresh(), /requires a body/);
    assert.equal(await store.needsBootstrap(), true);
    assert.equal(await new KvStore(local.executor).get("sync_cursor"), cursor);
    mode = "body";
    await bundle.refresh();
    assert.equal(await store.needsBootstrap(), false);
    assert.deepEqual(etags.slice(-3), [null, null, null]);
    assert.deepEqual(await kept(), before);
    await new OutboxRepository(local.executor, () => PROJECTION_NOW).enqueue(
      lifecycleEvent(draft),
      new LifecycleStore(local.executor).commitStatements(draft),
    );
    assert.deepEqual(
      (await local.executor.query("SELECT id FROM outbox_event ORDER BY id")).map((row) => row.id),
      [CONTRACT_IDS.actor, CONTRACT_IDS.source].sort(),
    );
  } finally {
    local.close();
  }
}

async function recoveryFacts(db: SqlExecutor) {
  return Promise.all([
    new OvitrapStore(db).snapshots().then((value) => value.assignment),
    db.query("SELECT * FROM lifecycle_courier_projection ORDER BY kind,id"),
    db.query("SELECT * FROM day_sampling_point ORDER BY id"),
    db.query("SELECT * FROM lifecycle_draft"),
    db.query("SELECT * FROM lifecycle_capture ORDER BY event_id"),
    db.query("SELECT * FROM lifecycle_evidence ORDER BY event_id,evidence_id"),
    db.query("SELECT id,payload,device_time FROM outbox_event ORDER BY id"),
    db.query("SELECT * FROM lifecycle_receipt ORDER BY event_id,ovitrap_id"),
  ]);
}

async function assertKnownQuadrantInvalidation(db: SqlExecutor, bundle: DayBundleService) {
  const open = { ...QUADRANT_REFERENCE, is_closed: false, closure_id: null };
  const missingId = {
    resource_type: open.resource_type,
    code: open.code,
    center_id: open.center_id,
    quadrant_id: open.quadrant_id,
    revision: open.revision,
    is_closed: false,
    closure_id: null,
  };
  let sequence = 1;
  for (const data of [null, { ...open, id: "invalid-uuid" }, missingId]) {
    await bundle.applyProjectionChanges(
      projectionChanges({ quadrants: [quadrantChange(open, sequence++)] }),
    );
    assert.equal(
      (
        await db.query(`SELECT EXISTS(${capturePointScopeSql("?")}) AS allowed`, [
          CONTRACT_IDS.point,
        ])
      )[0]?.allowed,
      1,
    );
    const beforeDraft = await db.query("SELECT draft FROM lifecycle_draft");
    await bundle.applyProjectionChanges(
      projectionChanges({ quadrants: [quadrantChange(data, sequence++)] }),
    );
    const [invalidRow] = await db.query(
      "SELECT body FROM lifecycle_courier_projection WHERE kind='quadrant' AND id=?",
      [CONTRACT_IDS.quadrant],
    );
    assert.equal(
      (JSON.parse(String(invalidRow?.body)) as { _available: boolean })._available,
      false,
    );
    await assert.rejects(saveProjectionCapture(db), /could not be saved/);
    assert.deepEqual(await db.query("SELECT draft FROM lifecycle_draft"), beforeDraft);
    assert.deepEqual(await db.query("SELECT * FROM outbox_event"), []);
  }
  const beforeContradiction = await db.query(
    "SELECT * FROM lifecycle_courier_projection ORDER BY kind,id",
  );
  await assert.rejects(
    bundle.applyProjectionChanges(
      projectionChanges({
        quadrants: [quadrantChange({ ...open, id: CONTRACT_IDS.actor, revision: 0 }, sequence++)],
      }),
    ),
    { boundary: "envelope" },
  );
  assert.deepEqual(
    await db.query("SELECT * FROM lifecycle_courier_projection ORDER BY kind,id"),
    beforeContradiction,
  );
}

void test("C3/C4: typed history and epoch floors share the existing projection transaction", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "m09-epoch-floor-"));
  const path = join(directory, "synthetic.sqlite");
  let local = await openTestDatabase(path);
  t.after(async () => {
    local.close();
    await rm(directory, { recursive: true, force: true });
  });
  const store = new DayStore(local.executor);
  const bundle = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: projectionBundle() }),
  });
  await bundle.refresh();
  await prepareProjectionCapture(local.executor);
  await bundle.applyProjectionChanges(
    projectionChanges({
      history: [
        historyChange(REVIEW_HISTORY),
        historyChange(SHIFT_HISTORY),
        historyChange(TRANSFER_HISTORY),
      ],
    }),
  );
  const rows = await local.executor.query(
    "SELECT kind,body FROM lifecycle_courier_projection WHERE kind LIKE 'history.%' ORDER BY kind",
  );
  assert.deepEqual(
    rows.map((row) => row.kind),
    ["history.review_decision", "history.shift_validation", "history.transfer_custody"],
  );
  const [review] = rows;
  assert.equal(
    (JSON.parse(String(review?.body)) as Record<string, unknown>).source_status,
    "in_review",
  );
  await assertKnownQuadrantInvalidation(local.executor, bundle);
  const closed = { ...QUADRANT_REFERENCE, is_closed: true, closure_id: CONTRACT_IDS.history };
  await bundle.applyProjectionChanges(
    projectionChanges({ quadrants: [quadrantChange(closed, 20)] }),
  );
  await bundle.applyProjectionChanges(
    projectionChanges({
      quadrants: [quadrantChange({ ...closed, is_closed: false, closure_id: null }, 21)],
    }),
  );
  let [row] = await local.executor.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='quadrant' AND id=?",
    [CONTRACT_IDS.quadrant],
  );
  assert.equal(
    (JSON.parse(String(row?.body)) as Record<string, unknown>).is_closed,
    true,
    "same epoch cannot reopen a closed quadrant",
  );
  await assert.rejects(saveProjectionCapture(local.executor), /could not be saved/);
  assert.deepEqual(await local.executor.query("SELECT * FROM outbox_event"), []);
  await bundle.applyProjectionChanges(
    projectionChanges({
      quadrants: [
        quadrantChange({ ...closed, revision: 4, is_closed: false, closure_id: null }, 22),
      ],
    }),
  );
  [row] = await local.executor.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='quadrant' AND id=?",
    [CONTRACT_IDS.quadrant],
  );
  assert.equal(
    (JSON.parse(String(row?.body)) as Record<string, unknown>).is_closed,
    false,
    "a real newer geometry epoch can open",
  );
  assert.equal(
    (
      await local.executor.query(`SELECT EXISTS(${capturePointScopeSql("?")}) AS allowed`, [
        CONTRACT_IDS.point,
      ])
    )[0]?.allowed,
    1,
  );
  await bundle.applyProjectionChanges(projectionChanges({ capture_context: CAPTURE_CONTEXT }));
  await assert.rejects(
    saveProjectionCapture(local.executor),
    /could not be saved/,
    "crossed grant axes are not a grant",
  );
  await bundle.applyProjectionChanges(
    projectionChanges({ quadrants: [quadrantChange({ ...closed, revision: 0 }, 23)] }),
  );
  await assert.rejects(saveProjectionCapture(local.executor), /could not be saved/);
  await new OvitrapStore(local.executor).saveSnapshots({ catalog: null, rules: null });
  await assert.rejects(
    saveProjectionCapture(local.executor),
    /could not be saved/,
    "late configuration cannot resurrect epoch authority",
  );
  const before = await local.executor.query(
    "SELECT * FROM lifecycle_courier_projection ORDER BY kind,id",
  );
  await assert.rejects(
    bundle.applyProjectionChanges(
      projectionChanges({ history: [{ ...historyChange(), resource_type: "history.invented" }] }),
    ),
  );
  assert.deepEqual(
    await local.executor.query("SELECT * FROM lifecycle_courier_projection ORDER BY kind,id"),
    before,
  );
  const complete = projectionBundle();
  await assert.rejects(
    store.replace(
      { ...complete, quadrants: [...complete.quadrants, complete.quadrants[0]] },
      PROJECTION_NOW,
    ),
  );
  assert.deepEqual(
    await local.executor.query("SELECT * FROM lifecycle_courier_projection ORDER BY kind,id"),
    before,
  );
  await bundle.applyProjectionChanges(
    projectionChanges({
      history: [{ ...historyChange({ ...REVIEW_HISTORY, revision: 0 }), sequence: 9 }],
    }),
  );
  const invalid = await local.executor.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='history.review_decision'",
  );
  assert.equal((JSON.parse(String(invalid[0]?.body)) as { _available: boolean })._available, false);
  await bundle.applyProjectionChanges(
    projectionChanges({ history: [historyChange(REVIEW_HISTORY)] }),
  );
  assert.deepEqual(
    await local.executor.query(
      "SELECT body FROM lifecycle_courier_projection WHERE kind='history.review_decision'",
    ),
    invalid,
  );
  await bundle.applyProjectionChanges(
    projectionChanges({
      history: [{ ...historyChange(REVIEW_HISTORY), sequence: 10, resource_version: "0" }],
    }),
  );
  assert.equal(
    (
      JSON.parse(
        String(
          (
            await local.executor.query(
              "SELECT body FROM lifecycle_courier_projection WHERE kind='history.review_decision'",
            )
          )[0]?.body,
        ),
      ) as { source_status: string }
    ).source_status,
    "in_review",
  );
  await bundle.revoke();
  local.close();
  local = await openTestDatabase(path);
  const reopened = new DayBundleService({
    store: new DayStore(local.executor),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: projectionBundle() }),
  });
  await reopened.refresh();
  const floor = await local.executor.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='quadrant'",
  );
  assert.equal((JSON.parse(String(floor[0]?.body)) as { revision: number }).revision, 4);
  await assert.rejects(
    saveProjectionCapture(local.executor),
    /could not be saved/,
    "reopen plus an older bootstrap cannot reopen the epoch",
  );
});

async function saveProjectionCapture(db: SqlExecutor, id = CONTRACT_IDS.source) {
  const draft = await prepareProjectionCapture(db, id);
  const store = new LifecycleStore(db);
  const outbox = new OutboxRepository(db, () => PROJECTION_NOW);
  await outbox.enqueue(lifecycleEvent(draft), store.commitStatements(draft));
  return draft;
}
async function prepareProjectionCapture(db: SqlExecutor, id = CONTRACT_IDS.source) {
  const store = new LifecycleStore(db);
  const previous = await store.read();
  if (previous.draft?.eventId === id) return previous.draft; // Restore never seals or reseals origin.
  if ((await db.query("PRAGMA user_version"))[0]?.user_version === 14) {
    const draft = projectionDraft(id);
    await store.begin(draft, previous.draft?.eventId ?? null);
    return draft;
  }
  const turn = await projectionStartTurn(db);
  return startOwnedLifecycleDraft({
    store,
    handle: turn.handle,
    ownerFence: turn.ownerFence,
    admit: turn.write,
    expectedEventId: previous.draft?.eventId ?? null,
    uuid: () => id,
    create: (freshEventId) => currentProjectionDraft(db, turn, freshEventId),
  });
}
async function projectionStartTurn(db: SqlExecutor) {
  const identity = PROJECTION_IDENTITY;
  await new KvStore(db).set(
    "session_profile",
    JSON.stringify({
      userId: identity.owner.userId,
      sessionId: identity.sessionId,
      issuer: identity.owner.issuer,
      organization: {
        id: identity.owner.organizationId,
        timezone: "America/Mexico_City",
        epi_week: "iso",
      },
    }),
  );
  await new AttachmentStore(db).bindSession(identity);
  const bundle = new DayBundleService({
    store: new DayStore(db),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => identity,
    transport: () => Promise.reject(new Error("Explicit bootstrap already provided")),
  });
  return bundle.captureLifecycleSource()(
    { kind: "new", ovitrapId: PROJECTION_TRAP.id },
    async (turn) => {
      const template = projectionDraft();
      await new LifecycleStore(db).saveConfiguration(
        { catalog: template.catalog, rules: template.rules },
        turn,
      );
      return {
        ...turn,
        source: await turn.resolve({ kind: "new", ovitrapId: PROJECTION_TRAP.id }),
      };
    },
  );
}
async function currentProjectionDraft(
  db: SqlExecutor,
  turn: LifecycleSourceTurn,
  eventId: string,
): Promise<CurrentLifecycleDraft> {
  assert.ok(turn.source);
  const template = projectionDraft(eventId);
  const draft = await startDraft(
    {
      store: new LifecycleStore(db),
      engine: { enqueue: () => Promise.reject(new Error("Fixture creation only")) },
      now: () => PROJECTION_NOW,
      uuid: () => eventId,
      gps: { locate: () => Promise.resolve(null) },
      evidence: { capture: () => Promise.resolve(null) },
      shiftId: () => Promise.resolve(template.shiftId),
    },
    {
      kind: "relocate",
      ovitrapId: PROJECTION_TRAP.id,
      manualCapture: false,
      source: turn.source,
      freshEventId: eventId,
      deviceTime: PROJECTION_NOW.toISOString(),
    },
  );
  return {
    ...draft,
    gps: template.gps,
    proposedLocation: template.proposedLocation,
    reasonCode: template.reasonCode,
    otherText: template.otherText,
    evidence: template.evidence,
    reviewAcknowledged: true,
  };
}
function terminalProposal() {
  return {
    ...RELOCATION_HISTORY,
    status: "approved" as const,
    decision: {
      id: CONTRACT_IDS.otherCenter,
      decision: "approved" as const,
      reason: null,
      decided_at: null,
      published_point_version: null,
    },
  };
}

void test("C3/C7: only newly owned sources retain immutable terminal dependencies across owner ABA and reauthentication", async (t) => {
  const local = await openTestDatabase(":memory:", 14);
  t.after(local.close);
  const legacyId = CONTRACT_IDS.device;
  const legacy = projectionDraft(legacyId);
  const capture = new OvitrapStore(local.executor);
  await capture.publishSnapshots(
    { catalog: null, rules: null, assignment: legacy.assignment },
    await capture.assignmentAuthority(),
  );
  await saveProjectionCapture(local.executor, legacyId);
  await migrate(local.executor);
  const legacyBefore = await local.executor.query("SELECT * FROM lifecycle_capture");
  const unproven = await new LifecycleService({
    store: new LifecycleStore(local.executor),
    engine: { enqueue: () => Promise.reject(new Error("Unproven work must stay local")) },
    now: () => PROJECTION_NOW,
    uuid: () => CONTRACT_IDS.source,
    gps: { locate: () => Promise.resolve(null) },
    evidence: { capture: () => Promise.resolve(null) },
    shiftId: () => Promise.resolve(CONTRACT_IDS.history),
  }).read();
  assert.equal(
    unproven.draft,
    null,
    "storage decoding cannot expose unproven private capture fields",
  );
  assert.deepEqual(unproven.history, []);
  assert.equal(unproven.recovery, "blocked_ownership");
  assert.deepEqual(await local.executor.query("SELECT * FROM lifecycle_capture"), legacyBefore);
  const store = new DayStore(local.executor);
  let identity = PROJECTION_IDENTITY;
  const service = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => identity,
    transport: () =>
      Promise.resolve({
        kind: "bundle",
        body: {
          ...projectionBundle(),
          capture_context: {
            ...projectionBundle().capture_context,
            user_id: identity.owner.userId,
          },
        },
      }),
  });
  await service.refresh();
  await saveProjectionCapture(local.executor);
  const terminal = terminalProposal();
  await service.applyProjectionChanges(
    projectionChanges({
      history: [
        historyChange(terminal),
        {
          ...historyChange({ ...terminal, id: CONTRACT_IDS.actor, proposal_event_id: legacyId }),
          sequence: 9,
        },
      ],
    }),
  );
  const original = await local.executor.query(
    "SELECT * FROM lifecycle_courier_projection WHERE kind IN ('lifecycle.owned-source','lifecycle.reviewed-proposal') ORDER BY kind,id",
  );
  const unknown = {
    sql: "INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body) VALUES('future.private',?,'unknown',0,'{\"_available\":false}')",
    params: [CONTRACT_IDS.organization],
  };
  await local.executor.runAtomically([unknown]);
  assert.equal(original.length, 2, "no backfill or later DTO can adopt a legacy capture");
  const handle = await store.captureTransport(identity, () => true);
  assert.equal(
    (await retainedProposal(local.executor, CONTRACT_IDS.source, handle))?.decision.reason,
    null,
  );
  await assert.rejects(
    local.executor.runAtomically([
      { sql: "DELETE FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-source'" },
    ]),
    /immutable/,
  );
  await service.revoke();
  assert.equal(await retainedProposal(local.executor, CONTRACT_IDS.source, handle), null);
  identity = {
    owner: { ...identity.owner, userId: CONTRACT_IDS.otherCenter },
    sessionId: "other-user-session",
  };
  await service.refresh();
  assert.equal(
    await retainedProposal(
      local.executor,
      CONTRACT_IDS.source,
      await store.captureTransport(identity, () => true),
    ),
    null,
  );
  await service.revoke();
  identity = { ...PROJECTION_IDENTITY, sessionId: "fresh-same-owner-session" };
  await service.refresh();
  assert.equal(
    (
      await retainedProposal(
        local.executor,
        CONTRACT_IDS.source,
        await store.captureTransport(identity, () => true),
      )
    )?.sourceEventId,
    CONTRACT_IDS.source,
  );
  assert.deepEqual(
    await local.executor.query(
      "SELECT * FROM lifecycle_courier_projection WHERE kind IN ('lifecycle.owned-source','lifecycle.reviewed-proposal') ORDER BY kind,id",
    ),
    original,
  );
  await assert.rejects(
    local.executor.runAtomically([
      {
        sql: "INSERT INTO lifecycle_void(event_id,target_event_id,reason_code,reason) VALUES(?,?,'other','correction')",
        params: [CONTRACT_IDS.organization, CONTRACT_IDS.source],
      },
    ]),
    /reviewed lifecycle/,
  );
  assert.equal((await local.executor.query("SELECT * FROM lifecycle_evidence")).length, 2);
  assert.equal(
    (
      await local.executor.query(
        "SELECT body FROM lifecycle_courier_projection WHERE kind='future.private'",
      )
    )[0]?.body,
    '{"_available":false}',
    "replacement/revoke only clear known downloaded kinds",
  );
});

void test("C3/C7: projection commit survives failed receipt settlement and retry settles the original UUID once", async (t) => {
  const local = await openTestDatabase(":memory:");
  t.after(local.close);
  const store = new DayStore(local.executor);
  const service = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: projectionBundle() }),
  });
  await service.refresh();
  await saveProjectionCapture(local.executor);
  let rejectReceipt = true;
  const receiptDb: SqlExecutor = {
    query: (sql, params) => local.executor.query(sql, params),
    runAtomically: (statements) =>
      rejectReceipt && statements.some((entry) => entry.params?.includes("last_sync_at"))
        ? Promise.reject(new Error("receipt storage failed"))
        : local.executor.runAtomically(statements),
  };
  const outbox = new OutboxRepository(receiptDb, () => PROJECTION_NOW);
  const reply = answer([accepted(CONTRACT_IDS.source)], { cursor: "first-page", hasMore: true });
  assert.ok(reply.ok);
  const response = {
    ...reply,
    response: {
      ...reply.response,
      changes: {
        ...reply.response.changes,
        ...projectionChanges({
          cursor: "first-page",
          has_more: true,
          history: [historyChange(terminalProposal())],
        }),
      },
    },
  };
  const requests: string[][] = [];
  const run = () =>
    runSyncPass(
      {
        outbox,
        kv: new KvStore(local.executor),
        ...service.syncHooks(),
        deviceId: CONTRACT_IDS.device,
        now: () => PROJECTION_NOW,
        transport: (request) => {
          requests.push(request.events.map((event) => event.id));
          return Promise.resolve(
            request.events.length
              ? response
              : {
                  ...response,
                  response: {
                    ...response.response,
                    results: [],
                    changes: {
                      ...response.response.changes,
                      cursor: "settled-cursor",
                      has_more: false,
                      history: [readHistoryChange(historyChange(SHIFT_HISTORY))],
                    },
                  },
                },
          );
        },
      },
      { batchSize: 50 },
    );
  await assert.rejects(run(), /receipt storage failed/);
  assert.equal(
    (await local.executor.query("SELECT local_status FROM outbox_event"))[0]?.local_status,
    "sending",
  );
  assert.equal(await new KvStore(local.executor).get("sync_cursor"), projectionBundle().cursor);
  const proof = await local.executor.query(
    "SELECT body FROM lifecycle_courier_projection WHERE kind='lifecycle.reviewed-proposal'",
  );
  assert.equal(
    proof.length,
    1,
    "first projection boundary really committed before the receipt failure",
  );
  rejectReceipt = false;
  await outbox.recoverInterrupted();
  assert.equal((await run()).kind, "idle");
  assert.deepEqual(requests, [[CONTRACT_IDS.source], [CONTRACT_IDS.source], []]);
  assert.deepEqual(
    await local.executor.query(
      "SELECT body FROM lifecycle_courier_projection WHERE kind='lifecycle.reviewed-proposal'",
    ),
    proof,
  );
  assert.equal(await new KvStore(local.executor).get("sync_cursor"), "settled-cursor");
  assert.deepEqual(
    (await local.executor.query("SELECT id,local_status FROM outbox_event")).map((row) => [
      row.id,
      row.local_status,
    ]),
    [[CONTRACT_IDS.source, "sent"]],
  );
  const finalEvent = makeEnvelope({ id: CONTRACT_IDS.otherQuadrant });
  await outbox.enqueue(finalEvent);
  let isCompleted = false;
  const final = await runSyncPass(
    {
      outbox,
      kv: new KvStore(local.executor),
      ...service.syncHooks(),
      deviceId: CONTRACT_IDS.device,
      now: () => PROJECTION_NOW,
      transport: async () => {
        await service.deferCleanup();
        assert.equal(
          (
            await local.executor.query(`SELECT EXISTS(${capturePointScopeSql("?")}) AS allowed`, [
              CONTRACT_IDS.point,
            ])
          )[0]?.allowed,
          0,
        );
        return {
          ...response,
          response: {
            ...response.response,
            results: [accepted(finalEvent.id)],
            changes: { ...response.response.changes, capture_context: null },
          },
          isSessionRevoked: true,
          completeSession: async () => {
            assert.equal(
              (
                await local.executor.query("SELECT local_status FROM outbox_event WHERE id=?", [
                  finalEvent.id,
                ])
              )[0]?.local_status,
              "sent",
            );
            isCompleted = true;
          },
        };
      },
    },
    { batchSize: 50 },
  );
  assert.equal(final.kind, "blocked");
  assert.equal(isCompleted, true);
  assert.deepEqual(
    await local.executor.query(
      "SELECT body FROM lifecycle_courier_projection WHERE kind='lifecycle.reviewed-proposal'",
    ),
    proof,
  );
});

void test("C4: the original transport identity and durable revision defeat late bootstrap and absent ABA", async (t) => {
  const local = await openTestDatabase(":memory:");
  t.after(local.close);
  const store = new DayStore(local.executor);
  let release!: (value: { kind: "bundle"; body: unknown }) => void;
  let entered!: () => void;
  const barrier = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let identity = PROJECTION_IDENTITY;
  const bundle = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => identity,
    transport: () => {
      entered();
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  const pending = bundle.refresh();
  await barrier;
  await store.revoke(); // independent writer: an in-memory session comparison alone misses this ABA
  identity = { ...PROJECTION_IDENTITY, sessionId: "B" };
  await store.revoke();
  identity = PROJECTION_IDENTITY;
  release({
    kind: "bundle",
    body: { ...projectionBundle(), quadrants: [], history: [], sampling_points: [], ovitraps: [] },
  });
  await assert.rejects(pending, /stale|changed/i);
  assert.equal(await store.needsBootstrap(), true);
  assert.equal(await new KvStore(local.executor).get("sync_cursor"), null);
  assert.deepEqual(await local.executor.query("SELECT * FROM lifecycle_courier_projection"), []);
  const fresh = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: projectionBundle() }),
  });
  await fresh.refresh();
  const handle = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  assert.ok(handle);
  const creatingTurn = await projectionStartTurn(local.executor);
  let originEntered!: () => void;
  let originRelease!: () => void;
  const originBarrier = new Promise<void>((resolve) => {
    originEntered = resolve;
  });
  const originResume = new Promise<void>((resolve) => {
    originRelease = resolve;
  });
  const creating = startOwnedLifecycleDraft({
    store: new LifecycleStore(local.executor),
    handle,
    ownerFence: creatingTurn.ownerFence,
    admit: creatingTurn.write,
    expectedEventId: null,
    uuid: () => CONTRACT_IDS.source,
    create: async (eventId) => {
      originEntered();
      await originResume;
      return currentProjectionDraft(local.executor, creatingTurn, eventId);
    },
  });
  await originBarrier;
  await store.revoke();
  await store.revoke(); // A→B→A with an absent/null context still changes the durable CAS
  originRelease();
  await assert.rejects(creating, /stale|changed/i);
  assert.deepEqual(
    await local.executor.query(
      "SELECT * FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-draft'",
    ),
    [],
  );
  assert.deepEqual(await local.executor.query("SELECT * FROM lifecycle_draft"), []);
  const recovery = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: projectionBundle() }),
  });
  await recovery.refresh();
  const outbox = new OutboxRepository(local.executor, () => PROJECTION_NOW);
  const originalEvent = makeEnvelope();
  await outbox.enqueue(originalEvent);
  let pullEntered!: () => void;
  let pullRelease!: () => void;
  const pullBarrier = new Promise<void>((resolve) => {
    pullEntered = resolve;
  });
  const pullResume = new Promise<void>((resolve) => {
    pullRelease = resolve;
  });
  const requests: string[][] = [];
  const recovering = runSyncPass(
    {
      outbox,
      kv: new KvStore(local.executor),
      ...recovery.syncHooks(),
      deviceId: CONTRACT_IDS.device,
      now: () => PROJECTION_NOW,
      transport: async (request) => {
        requests.push(request.events.map((event) => event.id));
        if (requests.length > 1) return answer([accepted(originalEvent.id)]);
        pullEntered();
        await pullResume;
        return httpFailure(400, "invalid_cursor");
      },
    },
    { batchSize: 50 },
  );
  await pullBarrier;
  await store.revoke();
  await store.revoke();
  pullRelease();
  await assert.rejects(
    recovering,
    /stale|changed/i,
    "invalid-cursor recovery cannot recapture a replacement durable handle",
  );
  assert.deepEqual(requests, [[originalEvent.id]]);
  assert.equal(
    (
      await local.executor.query("SELECT local_status FROM outbox_event WHERE id=?", [
        originalEvent.id,
      ])
    )[0]?.local_status,
    "pending",
  );
  assert.equal(await new KvStore(local.executor).get("sync_cursor"), null);
  await recovery.refresh();
  await projectionStartTurn(local.executor);
  let selected: typeof PROJECTION_IDENTITY | null = null;
  const originallyMissing = new DayBundleService({
    store: new DayStore(local.executor),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => selected,
    transport: () => Promise.reject(new Error("No request required")),
  });
  const originalRead = originallyMissing.captureLifecycleSource();
  selected = PROJECTION_IDENTITY;
  await assert.rejects(
    originalRead({ kind: "new", ovitrapId: PROJECTION_TRAP.id }, () => Promise.resolve(true)),
    RemoteSessionEnded,
    "a missing original identity cannot adopt the later proven owner",
  );
  assert.equal(
    await originallyMissing.captureLifecycleSource()(
      { kind: "new", ovitrapId: PROJECTION_TRAP.id },
      (turn) => Promise.resolve(turn.source?.physical.id),
    ),
    PROJECTION_TRAP.id,
  );
});
