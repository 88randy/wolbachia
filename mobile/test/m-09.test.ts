import assert from "node:assert/strict";
import { test } from "node:test";
import { navigationReducer } from "../src/navigation/routes.ts";
import { LifecycleService } from "../src/features/ovitrap-lifecycle/service.ts";
import { LifecycleStore } from "../src/features/ovitrap-lifecycle/store.ts";
import { StaleAssignmentAuthorityError } from "../src/features/ovitrap-check/snapshot-authority.ts";
import { saveGate, deliveryState } from "../src/features/ovitrap-lifecycle/domain.ts";
import { StaleCaptureError } from "../src/features/ovitrap-check/capture-identity.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { createStores, FIXED_NOW } from "./support/factories.ts";
import { engineFor, publishSnapshots } from "./support/m-08-harness.ts";
import { ASSIGNMENT, CATALOG, POINT, RULES, makeDraft } from "./support/m-08-fixtures.ts";
import type { TestStores } from "./support/factories.ts";
import type { LifecycleDraft } from "../src/features/ovitrap-lifecycle/types.ts";
import {
  hydrateLifecycleCaptureFixture,
  fixtureBundle,
} from "./support/lifecycle-capture-fixture.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";
import { startOwnedLifecycleDraft } from "../src/features/ovitrap-lifecycle/new-owned-draft.ts";
import { startDraft } from "../src/features/ovitrap-lifecycle/new-draft.ts";
const SOURCE = "44444444-4444-4444-8444-444444444444";
const PHOTO = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", fileRef: "file:///capture.jpg" };
const reason = (code: string) => ({
  code,
  label_es: code,
  label_en: code,
  is_other: code === "other",
  requires_photo: true,
});
let sequence = 0;
async function harness(local?: TestStores) {
  const stores = local ?? (await createStores());
  const capture = new OvitrapStore(stores.db);
  if ((await capture.snapshots()).assignment === null)
    await publishSnapshots(capture, {
      catalog: CATALOG,
      rules: RULES,
      assignment: { ...ASSIGNMENT, ovitraps: [{ id: SOURCE, point: POINT }] },
    });
  await hydrateLifecycleCaptureFixture(stores.db, ASSIGNMENT);
  const store = new LifecycleStore(stores.db);
  await store.saveConfiguration({
    catalog: {
      version: CATALOG.version,
      replace: [reason("damaged"), reason("other")],
      relocate: [reason("closed-house"), reason("other")],
      remove: [reason("abandoned"), reason("other")],
      voidReasons: [reason("other")],
    },
    rules: { ...RULES, closedHouseWeeks: 2, incidents: 3 },
  });
  const engine = engineFor(stores);
  const deps = {
    store,
    engine,
    now: () => FIXED_NOW,
    uuid: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`,
    gps: { locate: () => Promise.resolve({ lat: 19, lng: -99, accuracy_m: 5 }) },
    evidence: { capture: () => Promise.resolve(PHOTO) },
    shiftId: () => Promise.resolve("55555555-5555-4555-8555-555555555555"),
  };
  return { ...stores, store, engine, deps, service: new LifecycleService(deps) };
}
async function begin(h: Awaited<ReturnType<typeof harness>>, kind: LifecycleDraft["kind"]) {
  const current = await h.store.read();
  if (current.draft && !current.event)
    return startDraft(h.deps, { kind, ovitrapId: SOURCE, manualCapture: false }, current);
  const handle = await new DayStore(h.db).captureTransport(PROJECTION_IDENTITY, () => true);
  assert.ok(handle);
  const draft = await startOwnedLifecycleDraft({
    store: h.store,
    handle,
    uuid: h.deps.uuid,
    expectedEventId: current.draft?.eventId ?? null,
    create: (freshEventId) => {
      let isFirst = true;
      return startDraft(
        {
          ...h.deps,
          uuid: () => {
            if (!isFirst) return h.deps.uuid();
            isFirst = false;
            return freshEventId;
          },
        },
        { kind, ovitrapId: SOURCE, manualCapture: false },
        current,
      );
    },
  });
  h.service.draftBuffer.rebind(draft.eventId);
  return draft;
}
async function complete(h: Awaited<ReturnType<typeof harness>>, draft: LifecycleDraft) {
  await h.service.update(
    {
      reasonCode:
        draft.kind === "replace"
          ? "damaged"
          : draft.kind === "relocate"
            ? "closed-house"
            : "abandoned",
      recovery: "unrecovered",
    },
    draft.eventId,
  );
  await h.service.refreshGps(draft.eventId);
  await h.service.captureEvidence(draft.eventId);
}
void test("AC1: replacement retains fixed point code/lineage and reserves fresh physical UUIDs", async () => {
  const h = await harness();
  const first = await begin(h, "replace");
  await complete(h, first);
  await h.service.save(first.eventId);
  const projection = await h.store.physical(SOURCE);
  assert.equal(projection?.isRetired, true);
  assert.ok(first.replacementId);
  const replacement = await h.store.physical(first.replacementId);
  assert.equal(replacement?.point.code, POINT.code);
  assert.notEqual(replacement.id, SOURCE);
  assert.equal(replacement.isRetired, false);
  const next = await h.service.start(
    { kind: "replace", ovitrapId: first.replacementId, manualCapture: false },
    first.eventId,
  );
  assert.notEqual(next.draft?.replacementId, first.replacementId);
  const stack = navigationReducer(
    [{ name: "ovitrapReplace", ovitrapId: SOURCE, manualCapture: false }],
    {
      type: "push",
      route: { name: "ovitrapReplace", ovitrapId: first.replacementId, manualCapture: false },
    },
  );
  assert.equal(stack.length, 2);

  const [event] = await h.outbox.claimPending(10);
  assert.equal(event?.envelope.payload.replacement_id, first.replacementId);
  assert.equal(event.envelope.payload.ovitrap_id, SOURCE);
  assert.ok(next.draft?.replacementId);
  const reserved = next.draft.replacementId;
  const ids = [h.deps.uuid(), reserved];
  const restarted = new LifecycleService({
    ...h.deps,
    uuid: () => ids.shift() ?? "invalid",
    shiftId: () => Promise.resolve("66666666-6666-4666-8666-666666666666"),
  });
  await assert.rejects(
    restarted.start(
      { kind: "replace", ovitrapId: first.replacementId, manualCapture: false },
      next.draft.eventId,
    ),
  );
  assert.equal((await h.store.read()).draft?.eventId, next.draft.eventId);
  const placement = makeDraft({ eventId: h.deps.uuid(), mode: "place", ovitrapId: reserved });
  await h.store.capture.begin(placement);
  await assert.rejects(
    h.outbox.enqueue(captureEvent(placement), h.store.capture.commitStatements(placement)),
  );
});
void test("AC1: offline relocation is Proposed, retains geometry and requires GPS/photo/Other", async () => {
  const h = await harness();
  const draft = await begin(h, "relocate");
  await h.service.update({ reasonCode: "other" }, draft.eventId);
  await assert.rejects(h.service.save(draft.eventId));
  await h.service.refreshGps(draft.eventId);
  await assert.rejects(h.service.save(draft.eventId));
  await h.service.captureEvidence(draft.eventId);
  await assert.rejects(h.service.save(draft.eventId));
  await h.service.update({ otherText: "  Safer shaded entrance  " }, draft.eventId);
  const saved = await h.service.save(draft.eventId);
  assert.equal(saved.proposal?.status, "proposed");
  assert.equal(saved.proposal.nextDayTask, null);
  assert.deepEqual((await h.store.physical(SOURCE))?.point, POINT);
  assert.equal(saved.event?.envelope.payload.other_text, "Safer shaded entrance");
  assert.deepEqual(saved.event.envelope.payload.proposed_location, [-99, 19]);
  assert.equal(deliveryState(saved.event).server, "pending");
  assert.ok(saved.draft);
  assert.equal(saveGate({ ...saved.draft, otherText: "x".repeat(1001) }, FIXED_NOW), "other");
});
void test("AC1: removal requires an explicit recovery choice; unconfirmed remains local and sends false", async () => {
  for (const recovery of ["unrecovered", "unconfirmed", "recovered"] as const) {
    const h = await harness();
    const draft = await begin(h, "remove");
    assert.equal(draft.recovery, null);
    await complete(h, draft);
    await h.service.update({ recovery: null }, draft.eventId);
    await assert.rejects(h.service.save(draft.eventId));
    await h.service.update({ recovery }, draft.eventId);
    const saved = await h.service.save(draft.eventId);
    assert.equal(saved.event?.envelope.payload.is_recovered, recovery === "recovered");
    assert.equal(saved.draft?.recovery, recovery);
    assert.equal((await h.store.physical(SOURCE))?.isRetired, true);
  }
});
void test("AC2: synced decisions/task and reasoned correction preserve proposal/evidence across service restart", async () => {
  const h = await harness();
  const draft = await begin(h, "relocate");
  await complete(h, draft);
  await h.service.save(draft.eventId);
  const decision = {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    proposalEventId: draft.eventId,
    status: "rejected" as const,
    decidedAt: "2026-01-16T12:00:00Z",
    reason: "Keep current entrance",
    nextDayTask: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      dueDate: "2026-01-17",
      code: "synced-task",
    },
  };
  await h.store.ingestDecision(decision);
  await h.store.ingestDecision(decision);
  const restarted = new LifecycleService(h.deps);
  assert.equal((await restarted.read()).proposal?.status, "rejected");
  assert.deepEqual((await restarted.read()).proposal?.nextDayTask, decision.nextDayTask);
  await assert.rejects(
    restarted.correct(
      { reasonCode: "other", reason: "Reasoned correction of location" },
      draft.eventId,
    ),
  );
  assert.equal((await h.db.query("SELECT * FROM lifecycle_capture")).length, 1);
  const second = await harness();
  const original = await begin(second, "relocate");
  await complete(second, original);
  await second.service.save(original.eventId);
  await second.service.correct(
    { reasonCode: "other", reason: "Reasoned correction of location" },
    original.eventId,
  );
  const restored = await new LifecycleService(second.deps).read();
  assert.equal(restored.history[0]?.voidReason, "Reasoned correction of location");
  assert.deepEqual(restored.history[0].draft.evidence, [PHOTO]);
  assert.equal(restored.proposal?.status, "proposed");
  assert.equal(restored.proposal.isVoided, true);
  const approved = await harness();
  const proposal = await begin(approved, "relocate");
  await complete(approved, proposal);
  await approved.service.save(proposal.eventId);
  await approved.store.ingestDecision({
    ...decision,
    proposalEventId: proposal.eventId,
    status: "approved",
    nextDayTask: null,
  });
  assert.equal((await approved.service.read()).proposal?.status, "approved");
  assert.equal((await approved.service.read()).proposal?.nextDayTask, null);
  assert.deepEqual((await approved.store.physical(SOURCE))?.point, POINT);
});
void test("AC3: failed lifecycle transaction retains draft, references and truthfully pending state", async () => {
  const h = await harness();
  const draft = await begin(h, "replace");
  await complete(h, draft);
  await h.db.runAtomically([
    {
      sql: "CREATE TRIGGER disk_full BEFORE INSERT ON lifecycle_capture BEGIN SELECT RAISE(ABORT, 'full'); END",
    },
  ]);
  await assert.rejects(h.service.save(draft.eventId));
  assert.equal((await h.store.read()).event, null);
  assert.equal((await h.store.read()).draft?.eventId, draft.eventId);
  assert.deepEqual((await h.store.read()).draft?.evidence, [PHOTO]);
  assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 0);
  assert.equal((await h.store.physical(SOURCE))?.isRetired, false);
});
void test("AC3: every lifecycle command rejects the wrong displayed UUID before write or native effect", async () => {
  const h = await harness();
  const draft = await begin(h, "relocate");
  let effects = 0;
  const service = new LifecycleService({
    ...h.deps,
    gps: {
      locate: () => {
        effects++;
        return Promise.resolve(null);
      },
    },
    evidence: {
      capture: () => {
        effects++;
        return Promise.resolve(null);
      },
    },
  });
  const stale = "99999999-9999-4999-8999-999999999999";
  const commands = [
    () => service.start({ kind: "remove", ovitrapId: SOURCE, manualCapture: true }, stale),
    () => service.update({ otherText: "bad" }, stale),
    () => service.refreshGps(stale),
    () => service.captureEvidence(stale),
    () => service.removeEvidence(PHOTO.id, stale),
    () => service.undoEvidence(stale),
    () => service.adoptSnapshots(stale),
    () => service.refresh(stale),
    () => service.save(stale),
    () => service.correct({ reasonCode: "other", reason: "A reasoned correction" }, stale),
  ];
  for (const command of commands) await assert.rejects(command(), StaleCaptureError);
  assert.equal(effects, 0);
  assert.deepEqual((await h.store.read()).draft, draft);
  assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 0);
});

import { captureEvent } from "../src/features/ovitrap-check/events.ts";
import { relocationSuggestion } from "../src/features/ovitrap-lifecycle/thresholds.ts";
import {
  readLifecycleCatalog,
  readLifecycleRules,
} from "../src/features/ovitrap-lifecycle/snapshots.ts";
void test("AC2: advisory thresholds use delivered values and fixed-point local epi weeks across physical lineage", async () => {
  const h = await harness();
  const draft = await begin(h, "relocate");
  assert.ok(draft.rules);
  const base = makeDraft({ deviceTime: "2026-01-12T15:00:00Z", finding: "closed-house" });
  for (const [index, time] of ["2026-01-12T15:00:00Z", "2026-01-05T15:00:00Z"].entries()) {
    const check = {
      ...base,
      deviceTime: time,
      eventId: h.deps.uuid(),
      ovitrapId: index ? "99999999-9999-4999-8999-999999999999" : SOURCE,
    };
    await h.store.capture.begin(check);
    await h.outbox.enqueue(captureEvent(check), h.store.capture.commitStatements(check));
  }
  assert.deepEqual(await relocationSuggestion(h.db, draft), { closedHouseWeeks: 2 });
  assert.equal(
    await relocationSuggestion(h.db, { ...draft, rules: { ...draft.rules, closedHouseWeeks: 3 } }),
    null,
  );
  await h.service.update(
    { reasonCode: "other", otherText: "Advisory suggestion only" },
    draft.eventId,
  );
  await h.service.refreshGps(draft.eventId);
  await h.service.captureEvidence(draft.eventId);
  assert.equal((await h.service.save(draft.eventId)).proposal?.status, "proposed");
  const raw = {
    version: "downloaded",
    catalogs: [
      { slug: "replacement-reason", items: [reason("custom-reason")] },
      { slug: "relocation-reason", items: [reason("other")] },
      { slug: "removal-reason", items: [reason("custom-removal")] },
    ],
  };
  assert.deepEqual(
    readLifecycleCatalog(raw).replace.map((item) => item.code),
    ["custom-reason"],
  );
  const rules = readLifecycleRules({
    version: "rules",
    next_change_at: null,
    parameters: [
      { key: "closed_house_weeks_to_relocate", value: 4 },
      { key: "incidents_to_relocate", value: 7 },
    ],
  });
  assert.deepEqual([rules.closedHouseWeeks, rules.incidents], [4, 7]);
  assert.equal(
    readLifecycleRules({ version: "missing", next_change_at: null, parameters: [] })
      .closedHouseWeeks,
    null,
  );
});
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { KV_KEYS, KvStore } from "../src/db/kv-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { accepted, answer, scriptedTransport, httpFailure } from "./support/scripted-transport.ts";
import type { SqlExecutor } from "../src/db/sql.ts";
const storesFor = (db: SqlExecutor) => ({
  db,
  kv: new KvStore(db),
  outbox: new OutboxRepository(db, () => FIXED_NOW),
});
void test("AC3: cold SQLite reopen retains lifecycle draft and interrupted outbox send; retry sends original UUID once", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wolbachia-m09-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "wolbachia-m09-"));
  const path = join(directory, "phone.sqlite");
  let phone = await openTestDatabase(path);
  try {
    const first = await harness(storesFor(phone.executor));
    const draft = await begin(first, "remove");
    await complete(first, draft);
    phone.close();
    phone = await openTestDatabase(path);
    const second = await harness(storesFor(phone.executor));
    assert.equal((await second.store.read()).draft?.eventId, draft.eventId);
    const saved = await second.service.save(draft.eventId);
    assert.equal(deliveryState(saved.event).server, "pending");
    const denied = scriptedTransport([httpFailure(403, "permission_denied")]);
    await engineFor(storesFor(phone.executor), denied.transport, true).requestSync();
    assert.equal(deliveryState((await second.store.read()).event).server, "pending");
    await second.outbox.claimPending(10);
    phone.close();
    phone = await openTestDatabase(path);
    const third = storesFor(phone.executor);
    const transport = scriptedTransport([answer([accepted(draft.eventId)]), answer([])]);
    const engine = engineFor(third, transport.transport, true);
    await engine.retryNow();
    await engine.requestSync();
    assert.deepEqual(
      transport.requests.flatMap((request) => request.events.map((event) => event.id)),
      [draft.eventId],
    );
    const restored = await new LifecycleStore(third.db).read();
    assert.equal(deliveryState(restored.event).server, "received");
    assert.equal(restored.draft?.recovery, "unrecovered");
    assert.deepEqual(restored.history[0]?.draft.evidence, [PHOTO]);
    phone.close();
    phone = await openTestDatabase(path);
    const reopened = new LifecycleStore(phone.executor);
    assert.equal((await reopened.physical(SOURCE))?.isRetired, true);
    await new DayStore(phone.executor).applyChanges({
      assignments: [],
      map_manifests: [],
      sampling_points: [],
      has_more: false,
      ovitraps: [
        {
          sequence: 1,
          action: "upsert",
          resource_type: "ovitrap",
          resource_id: SOURCE,
          resource_version: "server-void-after-receipt",
          data: downloadedTrap(SOURCE),
        },
      ],
    });
    assert.equal((await reopened.physical(SOURCE))?.isRetired, false);
  } finally {
    phone.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "wolbachia-m09-"));
    rmSync(directory, { recursive: true });
  }
});
import { LifecycleDraftBuffer } from "../src/features/ovitrap-lifecycle/draft-buffer.ts";
import { runLifecycleAction } from "../src/features/ovitrap-lifecycle/run-action.ts";
void test("AC3: stale displayed action cannot flush another draft's buffered input; late GPS cannot adopt it", async () => {
  const h = await harness();
  const old = await begin(h, "relocate");
  const next = { ...old, eventId: h.deps.uuid(), otherText: "new draft" };
  let release: ((value: { lat: number; lng: number; accuracy_m: number }) => void) | undefined;
  let entered: () => void = () => {
    throw new Error("Barrier not initialized");
  };
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const delayed = new LifecycleService({
    ...h.deps,
    gps: {
      locate: () => {
        entered();
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    },
  });
  const pending = delayed.refreshGps(old.eventId);
  await ready;
  await h.store.begin(next, old.eventId);
  assert.ok(release);
  release({ lat: 20, lng: -100, accuracy_m: 5 });
  await assert.rejects(pending, StaleCaptureError);
  assert.equal((await h.store.read()).draft?.gps, null);
  h.service.draftBuffer.edit(next.eventId, { otherText: "buffer for B" });
  let notice = "";
  let actionCount = 0;
  await runLifecycleAction(
    {
      service: h.service,
      refresh: () => Promise.resolve(),
      setError: (key) => {
        notice = key ?? "";
      },
    },
    () => {
      actionCount++;
      return h.service.save(old.eventId);
    },
    old.eventId,
  );
  assert.equal(actionCount, 0);
  assert.equal(notice, "mobile.ovitrap.staleView");
  assert.equal((await h.store.read()).draft?.otherText, "new draft");
  const buffer = new LifecycleDraftBuffer();
  buffer.edit(old.eventId, { otherText: "wrong" });
  await assert.rejects(buffer.persist(h.service, next.eventId), StaleCaptureError);
});

void test("AC3 regression: a draft switched during departure authorization rejects before native ports", async () => {
  const h = await harness();
  const original = await begin(h, "relocate");
  let entered: () => void = () => {
    throw new Error("Missing barrier");
  };
  let release: ((shift: string) => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let nativeCalls = 0;
  let checks = 0;
  const service = new LifecycleService({
    ...h.deps,
    shiftId: () => {
      if (++checks > 1) return Promise.resolve(original.shiftId);
      entered();
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    gps: {
      locate: () => {
        nativeCalls++;
        return Promise.resolve(null);
      },
    },
  });
  const pending = service.refreshGps(original.eventId);
  await waiting;
  await h.store.begin({ ...original, eventId: h.deps.uuid() }, original.eventId);
  assert.ok(release);
  release(original.shiftId);
  await assert.rejects(pending, StaleCaptureError);
  assert.equal(nativeCalls, 0);
});

import { hasLocalRecords } from "../src/db/owner-data.ts";
import {
  courierChangeStatements,
  courierBundleStatements,
} from "../src/features/ovitrap-lifecycle/courier-projections.ts";
import type { Schemas } from "@wolbachia/api-client";
function downloadedTrap(id: string, isRetired = false): Schemas["OvitrapBundle"] {
  return {
    id,
    client_uuid: id,
    code: id,
    sampling_point_id: POINT.id,
    point_version: POINT.id,
    sampling_point_version: 1,
    version: "v1",
    placed_at: FIXED_NOW.toISOString(),
    reading_id: null,
    finding_code: null,
    paddle_present: null,
    has_eggs: null,
    checked_at: null,
    is_lagged: null,
    placement_voided: false,
    voided: false,
    voided_resource_type: null,
    voided_event_id: null,
    void_reason_code: "",
    voided_at: null,
    is_retired: isRetired,
  };
}
void test("AC3 regression: downloaded projections bind owner and resolve new physical UUID at a known authorized point", async () => {
  const local = await createStores();
  const trap = downloadedTrap(SOURCE);
  await local.db.runAtomically(courierBundleStatements({ ovitraps: [trap], sampling_points: [] }));
  assert.equal(await hasLocalRecords(local.db), true);
  const h = await harness(local);
  const next = downloadedTrap("99999999-9999-4999-8999-999999999999");
  await h.db.runAtomically(
    courierChangeStatements({
      ovitraps: [
        {
          sequence: 1,
          action: "upsert",
          resource_type: "ovitrap",
          resource_id: next.id,
          resource_version: next.version,
          data: next,
        },
      ],
      sampling_points: [],
    }),
  );
  assert.equal((await h.store.physical(next.id))?.point.code, POINT.code);
});
void test("AC2 regression: rejected void attempts retain history and do not mark a proposal voided", async () => {
  const h = await harness();
  const draft = await begin(h, "relocate");
  await complete(h, draft);
  await h.service.save(draft.eventId);
  await h.service.correct(
    { reasonCode: "other", reason: "Correcting the proposed entrance" },
    draft.eventId,
  );
  const [row] = await h.db.query("SELECT event_id FROM lifecycle_void");
  assert.equal(typeof row?.event_id, "string");
  assert.ok(row);
  const id = String(row.event_id);
  await h.outbox.claimPending(10);
  await h.outbox.settle([
    { id, action: "reject", result: { code: "void_dependency_conflict", params: {} } },
  ]);
  assert.equal((await h.service.read()).proposal?.isVoided, false);
  await h.service.correct(
    { reasonCode: "other", reason: "Correcting after supervisor guidance" },
    draft.eventId,
  );
  assert.equal((await h.db.query("SELECT * FROM lifecycle_void")).length, 2);
});
void test("AC2 regression: removal correction cannot restore occupancy over a later local placement", async () => {
  const h = await harness();
  const draft = await begin(h, "remove");
  await complete(h, draft);
  await h.service.save(draft.eventId);
  const placed = makeDraft({
    eventId: h.deps.uuid(),
    mode: "place",
    ovitrapId: h.deps.uuid(),
    deviceTime: "2026-01-16T15:00:00Z",
  });
  await h.store.capture.begin(placed);
  await h.outbox.enqueue(captureEvent(placed), h.store.capture.commitStatements(placed));
  await assert.rejects(
    h.service.correct(
      { reasonCode: "other", reason: "Do not restore over a new placement" },
      draft.eventId,
    ),
  );
  assert.equal((await h.db.query("SELECT * FROM lifecycle_void")).length, 0);
});
import { OvitrapService } from "../src/features/ovitrap-check/service.ts";
void test("AC1 wiring: M08 checks the replacement physical identity and blocks the retired source", async () => {
  const h = await harness();
  const draft = await begin(h, "replace");
  await complete(h, draft);
  const check = new OvitrapService({
    ...h.deps,
    store: h.store.capture,
    scanner: { scan: () => Promise.resolve({ status: "unavailable" }) },
  });
  const pendingCheck = await check.startCheck(SOURCE, true, null);
  assert.ok(pendingCheck.draft);
  await h.service.save(draft.eventId);
  assert.ok(draft.replacementId);
  await assert.rejects(check.startCheck(SOURCE, true, pendingCheck.draft.eventId));
  const state = await check.startCheck(draft.replacementId, true, pendingCheck.draft.eventId);
  assert.equal(state.draft?.point?.code, POINT.code);
  assert.deepEqual(state.draft.sourceEvidence, [PHOTO]);
  const [archived] = await h.db.query(
    "SELECT draft FROM ovitrap_superseded_draft WHERE event_id=?",
    [pendingCheck.draft.eventId],
  );
  assert.ok(archived);
  assert.equal(
    (JSON.parse(String(archived.draft)) as { eventId: string }).eventId,
    pendingCheck.draft.eventId,
  );
});

import { messages } from "@wolbachia/i18n";
import { componentHarness, flattenStyle } from "./support/m-09-render.ts";
void test("AC4: P15-P17 localized native props preserve labeled large controls across language/theme/text-scale", async () => {
  const keys = Object.keys(messages["es-MX"])
    .filter((key) => key.startsWith("mobile.lifecycle."))
    .sort();
  assert.ok(keys.length > 0);
  assert.deepEqual(
    keys,
    Object.keys(messages.en)
      .filter((key) => key.startsWith("mobile.lifecycle."))
      .sort(),
  );
  const h = await harness();
  const source = await begin(h, "relocate");
  await complete(h, source);
  await h.service.update({ reasonCode: "other", otherText: "visible" }, source.eventId);
  const matrix = (["es-MX", "en"] as const).flatMap((locale) =>
    (["light", "dark"] as const).flatMap((scheme) =>
      [1, 1.3].map((fontScale) => ({ locale, scheme, fontScale })),
    ),
  );
  for (const { locale, scheme, fontScale } of matrix) {
    const render = componentHarness({ locale, scheme, fontScale });
    for (const [name, kind] of [
      ["P15Screen", "replace"],
      ["P16Screen", "relocate"],
      ["P17Screen", "remove"],
    ] as const) {
      const draft = {
        ...source,
        kind,
        reasonCode: "other",
        otherText: "visible",
        evidence: [PHOTO],
        recovery: "unconfirmed",
      };
      const model = {
        state: { ...(await h.service.read()), draft },
        isBusy: false,
        edit: () => undefined,
        run: () => Promise.resolve(true),
        service: h.service,
      };
      const nodes = render.render(`mobile/src/features/ovitrap-lifecycle/${name}.tsx`, name, {
        draft,
        model,
      });
      const footer = render.render(
        "mobile/src/features/ovitrap-lifecycle/LifecycleFooter.tsx",
        "LifecycleFooter",
        { draft, model },
      );
      const reasonSheet = render.render(
        "mobile/src/features/ovitrap-lifecycle/CatalogSheet.tsx",
        "CatalogSheet",
        {
          isOpen: true,
          close: () => undefined,
          items: draft.catalog?.[kind] ?? [],
          code: "other",
          choose: () => undefined,
        },
      );
      assertScreenControls([...nodes, ...footer, ...reasonSheet], locale);
      const primary =
        kind === "remove" ? "mobile.lifecycle.confirmRemove" : "mobile.lifecycle.save";
      assert.ok(footer.some((item) => item.props.accessibilityLabel === messages[locale][primary]));
    }
    const sheet = render.render(
      "mobile/src/features/ovitrap-lifecycle/RemoveSheet.tsx",
      "RemoveSheet",
      {
        isOpen: true,
        isBusy: false,
        close: () => undefined,
        save: () => undefined,
        draft: source,
      },
    );
    assert.ok(sheet.some((item) => item.props.accessibilityViewIsModal === true));
    assert.ok(
      sheet.some(
        (item) => item.props.accessibilityLabel === messages[locale]["common.actions.cancel"],
      ),
    );
    assert.ok(
      sheet.some(
        (item) => item.props.accessibilityLabel === messages[locale]["mobile.lifecycle.remove"],
      ),
    );
  }
});

function assertScreenControls(
  nodes: readonly import("./support/m-09-render.ts").RenderNode[],
  locale: "es-MX" | "en",
): void {
  const controls = nodes.filter((item) => ["TextInput", "Pressable"].includes(String(item.type)));
  assert.ok(controls.length >= 4);
  for (const control of controls) {
    assert.equal(typeof control.props.accessibilityLabel, "string");
    assert.ok(String(control.props.accessibilityLabel).trim());
    assert.ok(Number(flattenStyle(control.props.style).minHeight) >= 48);
    assert.equal(control.props.allowFontScaling === false, false);
  }
  assert.ok(
    controls.some(
      (control) => control.props.accessibilityLabel === messages[locale]["mobile.lifecycle.other"],
    ),
  );
  assert.ok(
    controls.some(
      (control) =>
        control.props.accessibilityLabel === messages[locale]["mobile.lifecycle.captureGps"],
    ),
  );
  assert.ok(
    nodes
      .filter((item) => item.type === "Text")
      .every((item) => item.props.numberOfLines === undefined),
  );
}

void test("AC2: a draft started before configuration can adopt later downloaded catalog and rules", async () => {
  const h = await harness();
  const config = await h.store.configuration();
  await h.store.saveConfiguration({ catalog: null, rules: null });
  const draft = await begin(h, "relocate");
  await h.store.saveConfiguration(config);
  assert.equal((await h.service.read()).catalogChanged, true);
  const adopted = await h.service.adoptSnapshots(draft.eventId);
  assert.equal(adopted.draft?.catalog?.version, config.catalog?.version);
  assert.ok(config.rules);
  await h.store.saveConfiguration({ ...config, rules: { ...config.rules, version: "rules-v2" } });
  assert.equal((await h.service.read()).catalogChanged, true);
});
import { runSyncPass } from "../src/sync/sync-pass.ts";
void test("AC3 wiring: existing sync applies retired/current projections before receipt and cursor advancement", async () => {
  const h = await harness();
  const draft = await begin(h, "replace");
  await complete(h, draft);
  await h.service.save(draft.eventId);
  assert.ok(draft.replacementId);
  const reply = answer([accepted(draft.eventId)], { cursor: "lifecycle-cursor" });
  assert.equal(reply.ok, true);
  const traps = [downloadedTrap(SOURCE, true), downloadedTrap(draft.replacementId)];
  const response = {
    ...reply.response,
    changes: {
      ...reply.response.changes,
      ovitraps: traps.map((data, index) => ({
        sequence: index + 1,
        action: "upsert" as const,
        resource_type: "ovitrap",
        resource_id: data.id,
        resource_version: data.version,
        data,
      })),
    },
  };
  const transport = scriptedTransport([{ ok: true, response }]);
  await runSyncPass(
    {
      ...h,
      deviceId: SOURCE,
      now: () => FIXED_NOW,
      transport: transport.transport,
      ...new DayBundleService({
        store: new DayStore(h.db),
        now: () => FIXED_NOW,
        transport: () => Promise.reject(new Error("Unexpected bootstrap")),
      }).syncHooks(),
    },
    { batchSize: 50 },
  );
  assert.equal(await h.kv.get("sync_cursor"), "lifecycle-cursor");
  assert.equal(deliveryState((await h.store.read()).event).server, "received");
  assert.equal((await h.store.physical(SOURCE))?.isRetired, true);
  assert.equal((await h.store.physical(draft.replacementId))?.isRetired, false);
  // Older cursor replay cannot undo a newer retirement.
  await h.db.runAtomically(
    courierChangeStatements({
      ovitraps: [
        {
          sequence: 1,
          action: "upsert",
          resource_type: "ovitrap",
          resource_id: SOURCE,
          resource_version: "old",
          data: downloadedTrap(SOURCE),
        },
      ],
      sampling_points: [],
    }),
  );
  const [row] = await h.db.query("SELECT body FROM lifecycle_courier_projection WHERE id=?", [
    SOURCE,
  ]);
  assert.ok(row);
  assert.equal((JSON.parse(String(row.body)) as Schemas["OvitrapBundle"]).is_retired, true);
});

import { prepareCheck } from "./support/m-08-harness.ts";
const SECOND_SOURCE = "99999999-9999-4999-8999-999999999999";
const SECOND_POINT = { ...POINT, id: "77777777-7777-4777-8777-777777777777", code: "OV-2" };
import { PLACEMENT_PREPARATION } from "../src/features/ovitrap-check/domain.ts";
async function reviewCaptureHarness(mode: "check" | "place" = "check", local?: TestStores) {
  const h = await harness(local);
  const assignment = {
    ...ASSIGNMENT,
    points: [POINT, SECOND_POINT],
    ovitraps: [
      { id: SOURCE, point: POINT },
      { id: SECOND_SOURCE, point: SECOND_POINT },
    ],
  };
  await publishSnapshots(h.store.capture, {
    catalog: CATALOG,
    rules: RULES,
    assignment,
  });
  await hydrateLifecycleCaptureFixture(h.db, assignment, { force: true });
  const check = new OvitrapService({
    ...h.deps,
    store: h.store.capture,
    scanner: { scan: () => Promise.resolve({ status: "unavailable" }) },
  });
  const state =
    mode === "place" ? await check.startPlace(null) : await check.startCheck(SOURCE, true, null);
  assert.ok(state.draft);
  if (mode === "place")
    await check.update({ point: POINT, prepared: [...PLACEMENT_PREPARATION] }, state.draft.eventId);
  else await prepareCheck(check);
  await check.captureEvidence(state.draft.eventId);
  return { ...h, check, eventId: state.draft.eventId };
}
function pointProjection(isRetired: boolean): Schemas["SamplingPointBundle"] {
  return {
    id: POINT.id,
    code: POINT.code,
    block_id: POINT.id,
    quadrant_id: POINT.id,
    location: [POINT.lng, POINT.lat],
    is_retired: isRetired,
    version: 1,
  };
}
async function downloadRetirement(h: TestStores, kind: "trap" | "point", isRetired = true) {
  const trap = downloadedTrap(SOURCE, isRetired);
  const point = { ...pointProjection(isRetired), version: 2 };
  await h.db.runAtomically(
    courierChangeStatements({
      ovitraps:
        kind === "trap"
          ? [
              {
                sequence: 10,
                action: "upsert",
                resource_type: "ovitrap",
                resource_id: SOURCE,
                resource_version: "retirement",
                data: trap,
              },
            ]
          : [],
      sampling_points:
        kind === "point"
          ? [
              {
                sequence: 10,
                action: "upsert",
                resource_type: "sampling_point",
                resource_id: POINT.id,
                resource_version: String(point.version),
                data: point,
              },
            ]
          : [],
    }),
  );
}
const RETIREMENT_CASES = [
  { kind: "trap", mode: "check" },
  { kind: "point", mode: "check" },
  { kind: "point", mode: "place" },
] as const;
void test("review 1: downloaded physical or point retirement blocks M08 save and stale transactional capture", async () => {
  for (const { kind, mode } of RETIREMENT_CASES) {
    const h = await reviewCaptureHarness(mode);
    const state = await h.check.read();
    assert.ok(state.draft);
    await downloadRetirement(h, kind);
    if (kind === "point") {
      await h.db.runAtomically(
        courierChangeStatements({
          sampling_points: [1, 2].map((version) => ({
            sequence: 10 + version,
            action: "upsert",
            resource_type: "sampling_point",
            resource_id: POINT.id,
            resource_version: String(version),
            data: { ...pointProjection(false), version },
          })),
        }),
      );
      assert.equal((await h.store.physical(SOURCE))?.isRetired, true);
    }
    await assert.rejects(h.check.save(h.eventId));
    // Simulate a command that already passed its read-side check before the upsert arrived.
    await assert.rejects(
      h.outbox.enqueue(captureEvent(state.draft), h.store.capture.commitStatements(state.draft)),
    );
    assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 0);
    assert.equal((await h.db.query("SELECT * FROM ovitrap_capture")).length, 0);
    assert.deepEqual((await h.store.capture.read()).draft, state.draft);
  }
});
void test("review 2: downloaded retirement supersedes and archives the complete M08 draft atomically", async () => {
  for (const { kind, mode } of RETIREMENT_CASES) {
    const h = await reviewCaptureHarness(mode);
    const before = await h.check.read();
    assert.ok(before.draft);
    await downloadRetirement(h, kind);
    await h.db.runAtomically([
      {
        sql: `CREATE TRIGGER fail_supersede BEFORE UPDATE ON ovitrap_draft
      WHEN json_extract(NEW.draft,'$.eventId')<>json_extract(OLD.draft,'$.eventId')
      BEGIN SELECT RAISE(ABORT,'storage failure'); END`,
      },
    ]);
    await assert.rejects(h.check.startCheck(SECOND_SOURCE, true, h.eventId));
    assert.equal((await h.db.query("SELECT * FROM ovitrap_superseded_draft")).length, 0);
    assert.deepEqual((await h.store.capture.read()).draft, before.draft);
    await h.db.runAtomically([{ sql: "DROP TRIGGER fail_supersede" }]);
    const next = await h.check.startCheck(SECOND_SOURCE, true, h.eventId);
    assert.equal(next.draft?.ovitrapId, SECOND_SOURCE);
    const [row] = await h.db.query(
      "SELECT draft,replacement_event_id FROM ovitrap_superseded_draft WHERE event_id=?",
      [h.eventId],
    );
    assert.ok(row);
    assert.deepEqual(JSON.parse(String(row.draft)), before.draft);
    assert.equal(row.replacement_event_id, next.draft.eventId);
    assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 0);
  }
});
async function currentRetirement(db: SqlExecutor): Promise<boolean> {
  const physical = await new LifecycleStore(db).physical(SOURCE);
  assert.ok(physical);
  return physical.isRetired;
}
void test("review 3: downloaded active state overrides retired assignment fallback before current local effects", async () => {
  const h = await harness();
  await h.db.runAtomically([
    { sql: "DELETE FROM lifecycle_courier_projection WHERE kind='ovitrap'" },
  ]);
  await publishSnapshots(h.store.capture, {
    catalog: CATALOG,
    rules: RULES,
    assignment: { ...ASSIGNMENT, ovitraps: [{ id: SOURCE, point: POINT, isRetired: true }] },
  });
  assert.equal(await currentRetirement(h.db), true);
  await downloadRetirement(h, "trap", false);
  assert.equal(await currentRetirement(h.db), false);
  await hydrateLifecycleCaptureFixture(h.db, ASSIGNMENT, { force: true });
  const check = new OvitrapService({
    ...h.deps,
    store: h.store.capture,
    scanner: { scan: () => Promise.resolve({ status: "unavailable" }) },
  });
  const checked = await check.startCheck(SOURCE, true, null);
  assert.ok(checked.draft);
  await prepareCheck(check);
  await check.save(checked.draft.eventId);
  const draft = await begin(h, "remove");
  await complete(h, draft);
  await h.service.save(draft.eventId);
  assert.equal(await currentRetirement(h.db), true);
  const day = new DayStore(h.db);
  const page = async (sequence: number, isRetired: boolean, hasMore: boolean) =>
    day.applyChanges(
      {
        capture_context: fixtureBundle(ASSIGNMENT).capture_context,
        assignments: [],
        map_manifests: [],
        sampling_points: [],
        has_more: hasMore,
        ovitraps: [
          {
            sequence,
            action: "upsert",
            resource_type: "ovitrap",
            resource_id: SOURCE,
            resource_version: String(sequence),
            data: downloadedTrap(SOURCE, isRetired),
          },
        ],
      },
      await day.captureTransport(PROJECTION_IDENTITY, () => true),
    );
  await page(11, false, true); // Older feed pages never override pending local removal.
  assert.equal(await currentRetirement(h.db), true);
  await h.outbox.claimPending(10);
  await h.outbox.settle([{ id: draft.eventId, action: "accept" }]);
  await page(12, false, true);
  assert.equal(await currentRetirement(h.db), true);
  await page(13, true, true);
  assert.equal(await currentRetirement(h.db), true);
  await day.applyChanges(
    {
      capture_context: fixtureBundle(ASSIGNMENT).capture_context,
      assignments: [],
      map_manifests: [],
      ovitraps: [],
      sampling_points: [],
      has_more: false,
    },
    await day.captureTransport(PROJECTION_IDENTITY, () => true),
  );
  assert.equal(await currentRetirement(h.db), true);
  await page(14, false, false); // A later server void reactivates an acknowledged removal.
  assert.equal(await currentRetirement(h.db), false);
  await h.service.correct(
    { reasonCode: "other", reason: "Retirement corrected after verification" },
    draft.eventId,
  );
  assert.equal(await currentRetirement(h.db), false);
  await h.outbox.claimPending(10);
  const [voidRow] = await h.db.query("SELECT event_id FROM lifecycle_void");
  assert.ok(voidRow);
  await h.outbox.settle([{ id: String(voidRow.event_id), action: "accept" }]);
  await h.db.runAtomically(
    courierBundleStatements({
      ovitraps: [downloadedTrap(SOURCE, true)],
      sampling_points: [pointProjection(false)],
    }),
  );
  assert.equal(await currentRetirement(h.db), true);
});

import { DayStore } from "../src/features/day/store.ts";
import { RemoteSessionEnded } from "../src/auth/session-requests.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../src/db/migrations.ts";
import { databaseExecutor, migrateThrough } from "./support/sqlite-executor.ts";
import { makeEnvelope } from "./support/factories.ts";
void test("AC3 integration: bootstrap retirement and revocation share the projection gate while retaining lifecycle evidence", async () => {
  const h = await harness();
  const draft = await begin(h, "relocate");
  await complete(h, draft);
  await h.service.save(draft.eventId);
  const pending = await begin(h, "remove");
  await complete(h, pending);
  const historical = (await h.store.read()).draft;
  const generation = async () =>
    Number(
      (await h.db.query("SELECT generation FROM attachment_context WHERE slot=1"))[0]?.generation,
    );
  const beforeBootstrap = await generation();
  assert.equal(await h.kv.get(KV_KEYS.dayCompletionBootstrapPending), null); // Explicit fixture bootstrap is already hydrated.
  let hasScope = true;
  const bundle = new DayBundleService({
    store: new DayStore(h.db),
    now: () => FIXED_NOW,
    transport: () =>
      Promise.resolve({
        kind: "bundle",
        body: {
          bundle_version: "bootstrap-lifecycle",
          schema_version: "schema-1",
          scope_revision: "scope-1",
          next_change_at: null,
          map_manifest_ready: false,
          assignments: [],
          map_manifests: [],
          cursor: "bootstrap-lifecycle-cursor",
          ovitraps: hasScope ? [downloadedTrap(SOURCE, true)] : [],
          sampling_points: hasScope ? [pointProjection(false)] : [],
        },
      }),
  });
  await bundle.refresh();
  assert.equal(await generation(), beforeBootstrap + 1);
  assert.equal(await h.kv.get(KV_KEYS.dayCompletionBootstrapPending), null);
  assert.equal(await h.kv.get(KV_KEYS.daySamplingPointsBootstrapPending), null);
  assert.equal((await h.store.physical(SOURCE))?.isRetired, true);
  assert.equal((await h.service.read()).isScopeBlocked, false);
  hasScope = false;
  await bundle.refresh();
  assert.equal(await h.kv.get("sync_cursor"), "bootstrap-lifecycle-cursor");
  assert.equal((await h.service.read()).isScopeBlocked, true);
  assert.equal((await h.store.capture.snapshots()).assignment?.points.length ?? 0, 0);
  assert.deepEqual((await h.store.read()).draft, historical);
  await assert.rejects(h.service.save(pending.eventId));
  assert.equal((await h.db.query("SELECT id FROM outbox_event")).length, 1);
  const lateHooks = bundle.syncHooks();
  await bundle.clearSessionData();
  assert.equal(await generation(), beforeBootstrap + 3);
  assert.equal(
    (
      await h.db.query(
        "SELECT * FROM lifecycle_courier_projection WHERE kind NOT IN ('quadrant','block','lifecycle.owned-draft','lifecycle.owned-source','lifecycle.reviewed-proposal')",
      )
    ).length,
    0,
  );
  assert.equal(
    (
      await h.db.query(
        "SELECT * FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-source'",
      )
    ).length,
    1,
  );
  assert.equal((await h.store.capture.snapshots()).assignment, null);
  assert.ok(lateHooks.applyProjectionChanges);
  const lateReply = answer([]);
  assert.equal(lateReply.ok, true);
  await assert.rejects(
    lateHooks.applyProjectionChanges({
      ...lateReply.response.changes,
      ovitraps: [
        {
          sequence: 1,
          action: "upsert",
          resource_type: "ovitrap",
          resource_id: SOURCE,
          resource_version: "late",
          data: downloadedTrap(SOURCE),
        },
      ],
      sampling_points: [],
    }),
    RemoteSessionEnded,
  );
  assert.equal(
    (
      await h.db.query(
        "SELECT * FROM lifecycle_courier_projection WHERE kind NOT IN ('quadrant','block','lifecycle.owned-draft','lifecycle.owned-source','lifecycle.reviewed-proposal')",
      )
    ).length,
    0,
  );
  const retained = await h.store.read();
  assert.equal(retained.event, null);
  assert.deepEqual((await h.store.capture.event(draft.eventId))?.envelope.id, draft.eventId);
  assert.equal(deliveryState(await h.store.capture.event(draft.eventId)).server, "pending");
  assert.deepEqual(retained.draft?.evidence, [PHOTO]);
  assert.deepEqual(retained.history[0]?.draft.evidence, [PHOTO]);
});

async function seedCanonicalPointCache(local: TestStores, sourceVersion: number): Promise<void> {
  if (sourceVersion !== 9) return;
  await local.db.runAtomically([
    {
      sql: "INSERT INTO day_sampling_point(id,version,payload) VALUES(?,1,?)",
      params: [POINT.id, JSON.stringify(pointProjection(false))],
    },
  ]);
  await local.kv.remove(KV_KEYS.daySamplingPointsBootstrapPending);
}
void test("AC3 upgrade: canonical master schemas 8 and 9 retain M06 enrollment and point-cache readiness through lifecycle migrations", async () => {
  for (const sourceVersion of [8, 9]) {
    const database = new DatabaseSync(":memory:");
    const db = databaseExecutor(database);
    try {
      await migrateThrough(db, sourceVersion);
      const local = storesFor(db);
      const original = makeEnvelope({ payload: { ovitrap_id: SOURCE } });
      await local.outbox.enqueue(original);
      const payload = JSON.stringify({ id: "retained-task", ovitrap_id: SOURCE });
      await db.runAtomically([
        {
          sql: `INSERT INTO day_assignment(id,version,payload,retained_payload,kept,retained_event_ids)
      VALUES('retained-task','1',?,?,1,?)`,
          params: [payload, payload, JSON.stringify([original.id])],
        },
      ]);
      await seedCanonicalPointCache(local, sourceVersion);
      await migrate(db);
      const [version] = await db.query("PRAGMA user_version");
      assert.equal(version?.user_version, SCHEMA_VERSION);
      const [assignment] = await db.query(
        "SELECT retained_payload,retained_event_ids FROM day_assignment",
      );
      assert.equal(assignment?.retained_payload, payload);
      assert.equal(assignment.retained_event_ids, JSON.stringify([original.id]));
      const next = makeEnvelope({ payload: { ovitrap_id: SOURCE } });
      await local.outbox.enqueue(next);
      const [enrolled] = await db.query("SELECT retained_event_ids FROM day_assignment");
      assert.equal(enrolled?.retained_event_ids, JSON.stringify([original.id, next.id]));
      assert.equal((await local.outbox.claimPending(10)).length, 2);
      const points = await db.query("SELECT payload FROM day_sampling_point");
      assert.deepEqual(
        points.map((point) => point.payload),
        sourceVersion === 9 ? [JSON.stringify(pointProjection(false))] : [],
      );
      assert.equal(
        await local.kv.get(KV_KEYS.daySamplingPointsBootstrapPending),
        sourceVersion === 8 ? "true" : null,
      );
      assert.equal(await new DayStore(db).needsBootstrap(), true);
    } finally {
      database.close();
    }
  }
});

import { createLineageFixture } from "./support/lineage-fixtures.ts";
import { CANONICAL_MIGRATIONS, SCHEMA_VERSION } from "../src/db/migrations.ts";
import { seedLifecycleUpgrade, retainedLifecycleFacts } from "./support/lifecycle-upgrade.ts";
void test("AC3 upgrade: schema13 to14 backfills sent replacement/removal/void receipts and preserves provenance through cold reopen", async (test) => {
  const fixture = await createLineageFixture(test, {
    migrations: CANONICAL_MIGRATIONS,
    version: 12,
  });
  const expected = await seedLifecycleUpgrade(fixture.executor);
  await migrateThrough(fixture.executor, 13);
  const before = await retainedLifecycleFacts(fixture.executor);
  await migrateThrough(fixture.executor, 14);
  assert.equal((await fixture.executor.query("PRAGMA user_version"))[0]?.user_version, 14);
  assert.deepEqual(await retainedLifecycleFacts(fixture.executor), before);
  const receipts = await fixture.executor.query("SELECT * FROM lifecycle_receipt ORDER BY rowid");
  assert.deepEqual(
    receipts.map((row) => ({ ...row })),
    expected,
  );
  const reopened = fixture.reopen();
  await migrateThrough(reopened, 14);
  assert.deepEqual(await retainedLifecycleFacts(reopened), before);
  assert.deepEqual(
    await reopened.query("SELECT * FROM lifecycle_receipt ORDER BY rowid"),
    receipts,
  );
  await migrate(reopened);
  const after15 = await retainedLifecycleFacts(reopened);
  assert.deepEqual(
    after15.map((rows, index) =>
      index === 1 ? rows.filter((row) => row.key !== "lifecycle_bootstrap_pending") : rows,
    ),
    before,
  );
  assert.equal(await new KvStore(reopened).get("lifecycle_bootstrap_pending"), "true");
  assert.deepEqual(
    await reopened.query(
      "SELECT * FROM lifecycle_courier_projection WHERE kind='lifecycle.owned-source'",
    ),
    [],
  );
});

type ScopeRaceAction = "m08-save" | "m09-save" | "m09-correct";
async function prepareScopeRace(
  db: SqlExecutor,
  action: ScopeRaceAction,
): Promise<() => Promise<unknown>> {
  if (action === "m08-save") {
    const capture = await reviewCaptureHarness("check", storesFor(db));
    return () => capture.check.save(capture.eventId);
  }
  const h = await harness(storesFor(db));
  const draft = await begin(h, "relocate");
  await complete(h, draft);
  if (action === "m09-correct") await h.service.save(draft.eventId);
  return action === "m09-save"
    ? () => h.service.save(draft.eventId)
    : () =>
        h.service.correct(
          { reasonCode: "other", reason: "Correction interrupted by scope revocation" },
          draft.eventId,
        );
}
const SCOPE_CHANGES = ["point", "bootstrap", "revoke"] as const;
type ScopeChange = (typeof SCOPE_CHANGES)[number] | "closed" | "unknown";
const NARROWED_BUNDLE = {
  bundle_version: "narrowed",
  schema_version: "schema-1",
  scope_revision: "scope-2",
  next_change_at: null,
  map_manifest_ready: false,
  cursor: "narrowed-cursor",
  assignments: [],
  map_manifests: [],
  sampling_points: [],
  ovitraps: [],
};
async function changeCurrentScope(db: SqlExecutor, change: ScopeChange): Promise<void> {
  const projections = new DayStore(db);
  if (change === "closed" || change === "unknown") return changeCurrentEpoch(projections, change);
  if (change === "point")
    return projections.applyChanges({
      sampling_points: [
        {
          action: "upsert",
          sequence: 2,
          resource_type: "sampling_point",
          resource_id: POINT.id,
          resource_version: "2",
          data: { ...pointProjection(false), version: 2, location: [] },
        },
      ],
    });
  if (change === "bootstrap") return projections.replace(NARROWED_BUNDLE, FIXED_NOW);
  return projections.revoke();
}
async function changeCurrentEpoch(projections: DayStore, state: "closed" | "unknown") {
  const reference = fixtureBundle(ASSIGNMENT).quadrants.find(
    (row) => row.resource_type === "quadrant",
  );
  assert.ok(reference);
  const legacy = {
    resource_type: reference.resource_type,
    id: reference.id,
    code: reference.code,
    center_id: reference.center_id,
    quadrant_id: reference.quadrant_id,
    revision: reference.revision,
  };
  const data = state === "closed" ? { ...legacy, is_closed: true, closure_id: POINT.id } : legacy;
  await projections.applyChanges(
    {
      capture_context: fixtureBundle(ASSIGNMENT).capture_context,
      quadrants: [
        {
          action: "upsert",
          resource_type: "quadrant",
          resource_id: POINT.id,
          resource_version: `observed-${state}`,
          sequence: 2,
          data,
        },
      ],
    },
    await projections.captureTransport(PROJECTION_IDENTITY, () => true),
  );
}
const SCOPE_RACE_CASES: readonly { action: ScopeRaceAction; scopeChange: ScopeChange }[] = [
  ...(["m08-save", "m09-save", "m09-correct"] as const).flatMap((action) =>
    SCOPE_CHANGES.map((scopeChange) => ({ action, scopeChange })),
  ),
  ...(["m08-save", "m09-save"] as const).flatMap((action) =>
    (["closed", "unknown"] as const).map((scopeChange) => ({ action, scopeChange })),
  ),
];
void test("review scope race: late configuration or assignment publication cannot restore M08/M09 authority at commit", async () => {
  for (const { action, scopeChange } of SCOPE_RACE_CASES) {
    const base = await createStores();
    let isArmed = false;
    let entered: () => void = () => {
      throw new Error("Missing entry barrier");
    };
    let release: () => void = () => {
      throw new Error("Missing release barrier");
    };
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    const db: SqlExecutor = {
      ...base.db,
      runAtomically: async (statements) => {
        if (
          isArmed &&
          statements.some(({ sql }) =>
            /INSERT INTO (lifecycle_capture|lifecycle_void|ovitrap_capture)/.test(sql),
          )
        ) {
          isArmed = false;
          entered();
          await resume;
        }
        await base.db.runAtomically(statements);
      },
    };
    const run = await prepareScopeRace(db, action);
    const snapshots = new OvitrapStore(base.db);
    const oldSnapshot = await snapshots.snapshots();
    const oldAuthority = await snapshots.assignmentAuthority();
    const before = await base.db.query("SELECT id FROM outbox_event");
    const draftsBefore = await base.db.query(
      "SELECT 'M08' AS kind,draft FROM ovitrap_draft UNION ALL SELECT 'M09',draft FROM lifecycle_draft",
    );
    const evidenceBefore = await base.db.query(
      "SELECT 'M08' AS kind,event_id,evidence_id,file_ref FROM ovitrap_evidence UNION ALL SELECT 'M09',event_id,evidence_id,file_ref FROM lifecycle_evidence ORDER BY kind,event_id,evidence_id",
    );
    const filesBefore = await base.db.query("SELECT * FROM attachment_file ORDER BY id");
    isArmed = true;
    const pending = run();
    await ready;
    await changeCurrentScope(base.db, scopeChange);
    try {
      await snapshots.saveSnapshots(oldSnapshot);
      await assert.rejects(
        snapshots.publishSnapshots(oldSnapshot, oldAuthority),
        StaleAssignmentAuthorityError,
      );
    } finally {
      release();
    }
    await assert.rejects(pending);
    assert.deepEqual(await base.db.query("SELECT id FROM outbox_event"), before);
    assert.deepEqual(
      await base.db.query(
        "SELECT 'M08' AS kind,draft FROM ovitrap_draft UNION ALL SELECT 'M09',draft FROM lifecycle_draft",
      ),
      draftsBefore,
    );
    assert.equal((await base.db.query("SELECT event_id FROM lifecycle_void")).length, 0);
    assert.deepEqual(
      await base.db.query(
        "SELECT 'M08' AS kind,event_id,evidence_id,file_ref FROM ovitrap_evidence UNION ALL SELECT 'M09',event_id,evidence_id,file_ref FROM lifecycle_evidence ORDER BY kind,event_id,evidence_id",
      ),
      evidenceBefore,
    );
    assert.deepEqual(await base.db.query("SELECT * FROM attachment_file ORDER BY id"), filesBefore);
  }
});

const EMPTY_AUTHORITY_CASES = [false, true].flatMap((hasConfiguration) =>
  SCOPE_CHANGES.map((scopeChange) => ({ hasConfiguration, scopeChange })),
);
void test("review authority ABA: absent or null snapshots reject pre-change assignment publication and keep configuration valid", async () => {
  for (const { hasConfiguration, scopeChange } of EMPTY_AUTHORITY_CASES) {
    const local = await createStores();
    const store = new OvitrapStore(local.db);
    if (hasConfiguration) await store.saveSnapshots({ catalog: null, rules: null });
    const authority = await store.assignmentAuthority();
    const original = makeEnvelope();
    await local.outbox.enqueue(original);
    await changeCurrentScope(local.db, scopeChange);
    assert.deepEqual(await store.snapshots(), { catalog: null, rules: null, assignment: null });
    const oldSnapshot = { catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT };
    await store.saveSnapshots(oldSnapshot);
    await assert.rejects(
      store.publishSnapshots(oldSnapshot, authority),
      StaleAssignmentAuthorityError,
    );
    assert.deepEqual(await store.snapshots(), { catalog: CATALOG, rules: RULES, assignment: null });
    if (scopeChange === "point")
      await assert.rejects(
        store.publishSnapshots(oldSnapshot, await store.assignmentAuthority()),
        StaleAssignmentAuthorityError,
      );
    assert.equal((await local.outbox.claimPending(1))[0]?.envelope.id, original.id);
  }
});
