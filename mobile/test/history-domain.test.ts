import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { SqlExecutor } from "../src/db/sql.ts";
import type { EvidenceIdentity } from "../src/attachments/evidence-session.ts";
import { hasLocalRecords } from "../src/db/owner-data.ts";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { filterHistory, groupHistory } from "../src/features/history/domain.ts";
import { readHistory } from "../src/features/history/store.ts";
import { permitsSubjects } from "../src/features/history/scope.ts";
import { HistoryService } from "../src/features/history/service.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { makeEnvelope } from "./support/factories.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { makeDraft, POINT, CATALOG, RULES, ASSIGNMENT } from "./support/m-08-fixtures.ts";
import {
  CONTRACT_IDS as ID,
  REVIEW_HISTORY,
  LAB_HISTORY,
  COMMUNITY_HISTORY,
  SUPPLY_HISTORY,
} from "./support/lifecycle-contract-fixtures.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
  projectionBundle,
} from "./support/lifecycle-projection-fixtures.ts";

void test("P29 one current binding must cover every subject of a multi-subject fact", () => {
  const subjects = [
    { center_id: ID.center, quadrant_id: ID.quadrant },
    { center_id: ID.otherCenter, quadrant_id: ID.otherQuadrant },
  ];
  const binding = (centers: string[], quadrants: string[]) => ({
    centers: { mode: "selected" as const, ids: centers },
    quadrants: { mode: "selected" as const, ids: quadrants },
  });
  const whole = binding([ID.center, ID.otherCenter], [ID.quadrant, ID.otherQuadrant]);
  assert.equal(
    permitsSubjects(
      [binding([ID.center], [ID.quadrant]), binding([ID.otherCenter], [ID.otherQuadrant])],
      subjects,
    ),
    false,
  );
  assert.equal(permitsSubjects([whole], subjects), true);
  assert.equal(permitsSubjects([whole], []), false);
  assert.equal(permitsSubjects([whole], [{ center_id: null, quadrant_id: null }]), false);
});

function bundleFor(db: SqlExecutor, history: unknown[] = []) {
  return new DayBundleService({
    store: new DayStore(db),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: { ...projectionBundle(), history } }),
  });
}
void test("P29 offline restart retains original UUID, ingest verdict, review/void author and code lineage", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "history-144-")),
    path = join(directory, "synthetic.sqlite");
  let local = await openTestDatabase(path);
  t.after(async () => {
    local.close();
    await rm(directory, { recursive: true, force: true });
  });
  const review = {
    ...REVIEW_HISTORY,
    decision_kind: "void",
    decision_state: "voided",
    effect_state: "discarded",
    declared_void_target_uuid: ID.source,
  };
  const bundle = bundleFor(local.executor, [
    review,
    ...LAB_HISTORY,
    COMMUNITY_HISTORY,
    ...SUPPLY_HISTORY,
  ]);
  const captured = makeDraft({
    eventId: ID.source,
    point: { ...POINT, id: ID.point },
    finding: "closed-house",
    catalog: {
      ...CATALOG,
      findings: [
        {
          code: "closed-house",
          label_es: "Casa cerrada archivada",
          label_en: "Archived closed house",
          is_other: false,
          requires_photo: false,
        },
      ],
    },
  });
  const captures = new OvitrapStore(local.executor);
  await captures.publishSnapshots(
    {
      catalog: CATALOG,
      rules: RULES,
      assignment: { ...ASSIGNMENT, points: [{ ...POINT, id: ID.point }] },
    },
    await captures.assignmentAuthority(),
  );
  await bundle.refresh();
  assert.equal(
    await hasLocalRecords(local.executor),
    false,
    "downloaded history never becomes an authored owner record",
  );
  let outbox = new OutboxRepository(local.executor, () => PROJECTION_NOW);
  const original = makeEnvelope({
    id: ID.source,
    shift_id: ID.device,
    device_time: "2026-11-06T00:30:00Z",
    payload: { sampling_point_id: ID.point, bag_code: "B-144", finding: "closed-house" },
  });
  await captures.begin(captured);
  await outbox.enqueue(
    original,
    captures.commitStatements(captured, (await captures.read()).draftVersion),
  );
  await outbox.claimPending(1);
  await outbox.settle([
    { id: ID.source, action: "review", result: { code: "clock_skew", params: {} } },
  ]);
  const correction = makeEnvelope({
    id: ID.actor,
    type: "record.void",
    shift_id: ID.device,
    voids_event_id: ID.source,
    payload: { reason: "Original source corrected", reason_code: "mistake" },
  });
  await outbox.enqueue(correction);
  assert.equal(await hasLocalRecords(local.executor), true);
  local.close();
  local = await openTestDatabase(path);
  outbox = new OutboxRepository(local.executor, () => PROJECTION_NOW);
  const view = await readHistory(local.executor, PROJECTION_IDENTITY, "synthetic-courier");
  assert.equal(view.available, true);
  const capture = view.entries.find((entry) => entry.id === ID.source);
  assert.ok(capture);
  assert.equal(capture.status, "in_review");
  assert.deepEqual(capture.codes, ["B-144", "OV-138"]);
  assert.equal(capture.reason, null, "result codes are never displayed as authored prose");
  assert.deepEqual(capture.observation, {
    es: "Casa cerrada archivada",
    en: "Archived closed house",
  });
  const decision = view.entries.find((entry) => entry.id === `review_decision:${ID.history}`);
  assert.ok(decision);
  assert.equal(decision.status, "voided");
  assert.equal(decision.author, ID.actor);
  assert.equal(decision.voidsId, ID.source);
  assert.equal(decision.reason, REVIEW_HISTORY.reason);
  assert.ok(filterHistory(view.entries, "ov-138").some((entry) => entry.id === decision.id));
  assert.equal(
    filterHistory(view.entries, "closed-house").length,
    0,
    "private arbitrary payload is not a code index",
  );
  const groups = groupHistory([capture], "America/Mexico_City");
  const [group] = groups;
  assert.ok(group);
  assert.equal(group.date, "2026-11-05");
  assert.equal(group.shiftId, ID.device);
  const retry = await outbox.claimPending(1);
  assert.equal(
    retry[0]?.envelope.id,
    correction.id,
    "original UUID survives reopen and the one existing retry queue",
  );
  assert.equal(
    (await local.executor.query("SELECT COUNT(*) AS total FROM outbox_event"))[0]?.total,
    2,
  );
  await new DayStore(local.executor).revoke();
  assert.deepEqual(await readHistory(local.executor, PROJECTION_IDENTITY, "synthetic-courier"), {
    available: false,
    entries: [],
  });
  assert.equal(
    (await local.executor.query("SELECT COUNT(*) AS total FROM outbox_event"))[0]?.total,
    2,
  );
  assert.equal(
    (
      await local.executor.query(
        "SELECT COUNT(*) AS total FROM lifecycle_courier_projection WHERE kind LIKE 'history.%'",
      )
    )[0]?.total,
    0,
  );
});

void test("P29 missing/full-bootstrap readiness and exact owner/session fences hide retained downloaded facts", async (t) => {
  const local = await openTestDatabase(":memory:");
  t.after(local.close);
  const bundle = bundleFor(local.executor, [REVIEW_HISTORY]);
  assert.deepEqual(await readHistory(local.executor, PROJECTION_IDENTITY, "courier"), {
    available: false,
    entries: [],
  });
  await bundle.refresh();
  assert.equal((await readHistory(local.executor, PROJECTION_IDENTITY, "courier")).available, true);
  for (const identity of [
    { ...PROJECTION_IDENTITY, sessionId: "replacement-session" },
    { ...PROJECTION_IDENTITY, owner: { ...PROJECTION_IDENTITY.owner, organizationId: ID.point } },
    { ...PROJECTION_IDENTITY, owner: { ...PROJECTION_IDENTITY.owner, userId: ID.point } },
  ])
    assert.deepEqual(await readHistory(local.executor, identity, "replacement"), {
      available: false,
      entries: [],
    });
  await local.executor.runAtomically([
    { sql: "DELETE FROM kv WHERE key='history_projection_ready'" },
  ]);
  assert.equal(
    (await readHistory(local.executor, PROJECTION_IDENTITY, "courier")).available,
    false,
  );
});

void test("P29 late local read cannot republish after lock or accepted owner replacement", async (t) => {
  const local = await openTestDatabase(":memory:");
  t.after(local.close);
  const bundle = bundleFor(local.executor, [REVIEW_HISTORY]);
  await bundle.refresh();
  let identity: EvidenceIdentity | null = PROJECTION_IDENTITY;
  let isUnlocked = true;
  let resolve!: () => void;
  let began!: () => void;
  const started = new Promise<void>((done) => {
    began = done;
  });
  const barrier = new Promise<void>((done) => {
    resolve = done;
  });
  const blockedDb: SqlExecutor = {
    ...local.executor,
    query: async (sql, params) => {
      const result = await local.executor.query(sql, params);
      began();
      await barrier;
      return result;
    },
  };
  const service = new HistoryService({
    db: blockedDb,
    bundle,
    current: () => identity,
    auth: {
      subscribe: () => () => undefined,
      getSnapshot: () =>
        ({ phase: isUnlocked ? "unlocked" : "locked" }) as ReturnType<
          ConstructorParameters<typeof HistoryService>[0]["auth"]["getSnapshot"]
        >,
    },
  });
  const reading = service.read();
  await started;
  identity = null;
  isUnlocked = false;
  resolve();
  assert.deepEqual(await reading, { available: false, entries: [] });
});

void test("P29 current empty grants or A-to-B scope narrowing hides old A facts without deleting recoverable work", async (t) => {
  const local = await openTestDatabase(":memory:");
  t.after(local.close);
  let body = projectionBundle();
  const bundle = new DayBundleService({
    store: new DayStore(local.executor),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body }),
  });
  await bundle.refresh();
  const outbox = new OutboxRepository(local.executor, () => PROJECTION_NOW);
  const original = makeEnvelope({
    id: ID.source,
    payload: {
      sampling_point_id: ID.point,
      reason: "Private scope A observation",
      bag_code: "B-A-144",
    },
  });
  await outbox.enqueue(original);
  assert.equal(
    (await readHistory(local.executor, PROJECTION_IDENTITY, "courier")).entries.length,
    1,
  );
  for (const grants of [
    [],
    [
      {
        centers: { mode: "selected" as const, ids: [ID.otherCenter] },
        quadrants: { mode: "selected" as const, ids: [ID.otherQuadrant] },
      },
    ],
  ]) {
    body = { ...body, capture_context: { ...body.capture_context, grants } };
    await bundle.refresh(true);
    assert.deepEqual(await readHistory(local.executor, PROJECTION_IDENTITY, "courier"), {
      available: grants.length > 0,
      entries: [],
    });
    const [retained] = await outbox.claimPending(1);
    assert.ok(retained);
    assert.deepEqual(retained.envelope, original);
    await outbox.settle([{ id: ID.source, action: "release" }]);
  }
});
