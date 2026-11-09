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
import type { EvidenceCaptureContext } from "../src/features/ovitrap-check/types.ts";
import {
  hydrateLifecycleCaptureFixture,
  fixtureBundle,
} from "./support/lifecycle-capture-fixture.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";
import { createLifecycleSourcePort } from "../src/features/ovitrap-lifecycle/source-context.ts";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { acceptedEvidenceOwner } from "../src/attachments/accepted-owner.ts";
import { CredentialStore, EMPTY_CREDENTIALS } from "../src/auth/credential-store.ts";
import { memorySecrets, deferred } from "./support/auth-fakes.ts";

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
  const credentials = new CredentialStore(memorySecrets());
  await credentials.update(() => ({
    ...EMPTY_CREDENTIALS,
    origin: PROJECTION_IDENTITY.owner.issuer,
    sessionId: PROJECTION_IDENTITY.sessionId,
    pair: { access: "synthetic-m09-access", refresh: "synthetic-m09-refresh" },
  }));
  await credentials.runExclusive((transaction) => {
    transaction.grantUnlock(credentials.unlockGate());
  });
  const profile = {
    username: "m09-fixture",
    firstName: "Test",
    permissions: [],
    userId: PROJECTION_IDENTITY.owner.userId,
    sessionId: PROJECTION_IDENTITY.sessionId,
    issuer: PROJECTION_IDENTITY.owner.issuer,
    organization: {
      id: PROJECTION_IDENTITY.owner.organizationId,
      slug: "fixture",
      name: "Fixture",
      country: "MX",
      timezone: "America/Mexico_City",
      epi_week: "iso" as const,
      languages: ["es-MX"],
      label_phone: "",
      support_contact: "",
      logo_url: null,
    },
  };
  await stores.kv.set("session_profile", JSON.stringify(profile));
  const identity = () =>
    acceptedEvidenceOwner({
      profile,
      credentials: credentials.getSnapshot(),
      deviceId: PROJECTION_IDENTITY.owner.deviceId,
    });
  await new AttachmentStore(stores.db).bindSession(identity());
  const dayStore = new DayStore(stores.db);
  const bundle = new DayBundleService({
    store: dayStore,
    now: () => FIXED_NOW,
    getCaptureIdentity: identity,
    transport: () => Promise.reject(new Error("Explicit fixture hydration only")),
  });
  const source = createLifecycleSourcePort(bundle, credentials, stores.db);
  await bundle.captureLifecycleSource()(null, (turn) =>
    store.saveConfiguration(
      {
        catalog: {
          version: CATALOG.version,
          replace: [reason("damaged"), reason("other")],
          relocate: [reason("closed-house"), reason("other")],
          remove: [reason("abandoned"), reason("other")],
          voidReasons: [reason("other")],
        },
        rules: { ...RULES, closedHouseWeeks: 2, incidents: 3 },
        limits: { void_reason_min_length: 10, void_reason_max_length: 1000 },
      },
      turn,
    ),
  );
  const engine = engineFor(stores);
  const deps = {
    store,
    engine,
    source,
    now: () => FIXED_NOW,
    uuid: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`,
    gps: { locate: () => Promise.resolve({ lat: 19, lng: -99, accuracy_m: 5 }) },
    evidence: {
      capture: (context: EvidenceCaptureContext) =>
        Promise.resolve({
          ...PHOTO,
          authority: store.evidenceCaptureGuard(context.draftId),
        }),
    },
    shiftId: () => Promise.resolve("55555555-5555-4555-8555-555555555555"),
  };
  return {
    ...stores,
    store,
    engine,
    deps,
    bundle,
    dayStore,
    credentials,
    source,
    service: new LifecycleService(deps),
  };
}
async function begin(h: Awaited<ReturnType<typeof harness>>, kind: LifecycleDraft["kind"]) {
  const previous = await h.store.read();
  const state = await h.service.start(
    { kind, ovitrapId: SOURCE, manualCapture: false },
    previous.draft?.eventId ?? null,
  );
  assert.ok(state.draft);
  return state.draft;
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
/** Existing M08 consumers retain their own draft/shift authority when composed with M09. */
function checkEvidence(h: Awaited<ReturnType<typeof harness>>) {
  return {
    evidence: {
      capture: (context: EvidenceCaptureContext) =>
        Promise.resolve({
          ...PHOTO,
          authority: h.store.capture.evidenceCaptureGuard(context.draftId),
        }),
    },
    evidenceShift: async () => {
      const id = await h.deps.shiftId();
      return {
        id,
        guard: {
          sql: "SELECT 1 FROM ovitrap_draft WHERE slot=1 AND event_id IS NULL AND json_extract(draft,'$.shiftId')=?",
          params: [id],
        },
      };
    },
  };
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
  const localSource = await h.bundle.captureLifecycleSource()(
    { kind: "new", ovitrapId: first.replacementId },
    (turn) => Promise.resolve(turn.source?.physical),
  );
  assert.equal(localSource?.kind, "owned-local");
  assert.equal(localSource.sourceEventId, first.eventId);
  assert.equal(
    localSource.receipt,
    null,
    "pending local identity has no fabricated server version or receipt floor",
  );
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
    h.outbox.enqueue(
      captureEvent(placement),
      h.store.capture.commitStatements(placement, (await h.store.capture.read()).draftVersion),
    ),
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
  const savedDraft = (await h.store.read()).draft;
  assert.ok(savedDraft);
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
  await h.bundle.applyProjectionChanges(
    projectionChanges({ history: [historyChange(proposalHistory(savedDraft, decision))] }),
  );
  await h.bundle.applyProjectionChanges(
    projectionChanges({ history: [historyChange(proposalHistory(savedDraft, decision))] }),
  );
  assert.equal(
    (
      await h.db.query(
        "SELECT body FROM lifecycle_courier_projection WHERE kind='history.relocation_proposal' AND json_extract(body,'$.status')='rejected'",
      )
    ).length,
    1,
  );
  await currentFeedbackActions(h, savedDraft, decision);
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
  await second.source.read(null, async (turn) => {
    const config = await second.store.configuration(turn.handle);
    await second.store.saveConfiguration(
      { ...config, limits: { void_reason_min_length: 20, void_reason_max_length: 40 } },
      turn,
    );
  });
  await assert.rejects(
    second.service.correct({ reasonCode: "other", reason: "Too short" }, original.eventId),
  );
  await assert.rejects(
    second.service.correct(
      { reasonCode: "not-delivered", reason: "Reasoned correction of location" },
      original.eventId,
    ),
  );
  await second.service.correct(
    { reasonCode: "other", reason: "Reasoned correction of location" },
    original.eventId,
  );
  const restored = await new LifecycleService(second.deps).read();
  assert.equal(restored.history[0]?.voidReason, "Reasoned correction of location");
  assert.deepEqual(restored.history[0].draft.evidence, [PHOTO]);
  assert.equal(restored.proposal?.status, "proposed");
  assert.equal(restored.proposal.isVoided, true);
  await correctionOptionJourney();
  const approved = await harness();
  const proposal = await begin(approved, "relocate");
  await complete(approved, proposal);
  await approved.service.save(proposal.eventId);
  const acceptedDecision: RelocationDecision = {
    ...decision,
    proposalEventId: proposal.eventId,
    status: "approved",
    nextDayTask: null,
  };
  const savedApproved = (await approved.store.read()).draft;
  assert.ok(savedApproved);
  await approved.bundle.applyProjectionChanges(
    projectionChanges({
      history: [historyChange(proposalHistory(savedApproved, acceptedDecision))],
    }),
  );
  assert.equal((await approved.service.read()).proposal?.status, "approved");
  assert.equal((await approved.service.read()).proposal?.nextDayTask, null);
  assert.deepEqual((await approved.store.physical(SOURCE))?.point, POINT);
  const projectedPoint = { ...pointProjection(false), version: 2, location: [-98.5, 19.5] };
  await approved.bundle.applyProjectionChanges(
    projectionChanges({
      sampling_points: [
        {
          action: "upsert",
          resource_type: "sampling_point",
          resource_id: POINT.id,
          resource_version: "2",
          sequence: 30,
          data: projectedPoint,
        },
      ],
    }),
  );
  assert.deepEqual((await approved.store.physical(SOURCE))?.point, {
    ...POINT,
    lat: 19.5,
    lng: -98.5,
  });
  assert.deepEqual(
    (await approved.store.read()).draft?.point,
    savedApproved.point,
    "Only the real point projection changes geometry; original capture stays frozen",
  );
});
import { historyChange, RELOCATION_HISTORY } from "./support/lifecycle-contract-fixtures.ts";
import { projectionChanges } from "./support/lifecycle-projection-fixtures.ts";
import type { RelocationDecision } from "../src/features/ovitrap-lifecycle/types.ts";
function proposalHistory(draft: LifecycleDraft, decision: RelocationDecision) {
  return {
    ...RELOCATION_HISTORY,
    proposal_event_id: draft.eventId,
    point_id: draft.point.id,
    point_code: draft.point.code,
    proposed_location: [...(draft.proposedLocation ?? [])],
    status: decision.status,
    decision: {
      id: decision.id,
      decision: decision.status,
      reason: decision.reason,
      decided_at: decision.decidedAt,
      published_point_version: null,
    },
    next_day_task: decision.nextDayTask
      ? {
          id: decision.nextDayTask.id,
          code: decision.nextDayTask.code,
          due_date: decision.nextDayTask.dueDate,
        }
      : null,
  };
}
void test("AC3: failed lifecycle transaction retains draft, references and truthfully pending state", async (test) => {
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
  await actualEvidenceJourney(test);
  await lifecyclePhotoWriterArbitration(test);
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
void test("AC2: advisory thresholds use delivered values and fixed-point local epi weeks across physical lineage", async (test) => {
  const h = await harness();
  const draft = await begin(h, "relocate");
  assert.ok(draft.rules);
  const base = makeDraft({ deviceTime: "2026-01-12T15:00:00Z", finding: "closed-house" });
  for (const [index, time] of ["2026-01-16T15:00:00Z", "2026-01-05T15:00:00Z"].entries()) {
    const check = {
      ...base,
      deviceTime: time,
      eventId: h.deps.uuid(),
      ovitrapId: index ? "99999999-9999-4999-8999-999999999999" : SOURCE,
    };
    await h.store.capture.begin(check);
    await h.outbox.enqueue(
      captureEvent(check),
      h.store.capture.commitStatements(check, (await h.store.capture.read()).draftVersion),
    );
  }
  assert.deepEqual(await relocationSuggestion(h.db, draft), {
    state: "unavailable",
    reason: "advisory_not_loaded",
  });
  assert.equal((await h.service.read()).suggestion, null);
  const legacy = { ...draft, schemaVersion: undefined, source: undefined, assignment: ASSIGNMENT };
  assert.equal(
    await relocationSuggestion(h.db, legacy),
    null,
    "A future reading in the current epi week must not satisfy an earlier cutoff",
  );
  const earlier = { ...base, eventId: h.deps.uuid(), ovitrapId: h.deps.uuid() };
  await h.store.capture.begin(earlier);
  await h.outbox.enqueue(
    captureEvent(earlier),
    h.store.capture.commitStatements(earlier, (await h.store.capture.read()).draftVersion),
  );
  assert.deepEqual(await relocationSuggestion(h.db, legacy), { closedHouseWeeks: 2 });
  assert.equal(
    await relocationSuggestion(h.db, { ...legacy, rules: { ...draft.rules, closedHouseWeeks: 3 } }),
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
  await actualAdvisoryJourney(test);
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
  await originalSourceDuringSlowWork();
  await admittedCommitBeforeLock();
  await foregroundGpsLifecycle();
  await refreshCompletionJourney();
});

async function originalSourceDuringSlowWork() {
  for (const change of ["projection", "lock"] as const) {
    const h = await harness();
    const draft = await begin(h, "relocate");
    const before = await h.db.query("SELECT draft FROM lifecycle_draft");
    const entered = deferred<undefined>(),
      resume = deferred<undefined>();
    const service = new LifecycleService({
      ...h.deps,
      gps: {
        locate: async () => {
          entered.resolve(undefined);
          await resume.promise;
          return { lat: 19, lng: -99, accuracy_m: 5 };
        },
      },
    });
    const pending = service.refreshGps(draft.eventId);
    await entered.promise;
    await h.credentials.runExclusive(() => undefined); // No credential gate is held during the port await.
    if (change === "lock") await h.credentials.lock();
    else
      await h.bundle.applyProjectionChanges({
        cursor: "while-gps-held",
        has_more: false,
        assignments: [],
        map_manifests: [],
        capture_context: fixtureBundle(ASSIGNMENT).capture_context,
      });
    resume.resolve(undefined);
    await assert.rejects(pending, /scope|stale|changed/i);
    assert.deepEqual(await h.db.query("SELECT draft FROM lifecycle_draft"), before);
    assert.deepEqual(await h.db.query("SELECT * FROM outbox_event"), []);
  }
}
async function admittedCommitBeforeLock() {
  const local = await createStores(),
    entered = deferred<undefined>(),
    resume = deferred<undefined>();
  let armed = false;
  const db: SqlExecutor = {
    query: (sql, params) => local.db.query(sql, params),
    runAtomically: async (statements) => {
      if (
        armed &&
        statements.some((statement) => statement.sql.includes("INSERT INTO lifecycle_capture"))
      ) {
        armed = false;
        entered.resolve(undefined);
        await resume.promise;
      }
      await local.db.runAtomically(statements);
    },
  };
  const h = await harness(storesFor(db)),
    draft = await begin(h, "relocate");
  await complete(h, draft);
  const before = (await h.store.read()).draft;
  armed = true;
  const saving = h.service.save(draft.eventId);
  await entered.promise;
  const locking = h.credentials.lock(); // Restricts immediately; waits for already-admitted SQL.
  resume.resolve(undefined);
  await assert.rejects(saving, StaleCaptureError); // Late UI completion is ignored, not a rollback claim.
  await locking;
  assert.deepEqual((await h.store.read()).draft, before);
  assert.equal(
    (await h.db.query("SELECT event_id FROM lifecycle_capture"))[0]?.event_id,
    draft.eventId,
  );
  assert.equal((await h.db.query("SELECT count(*) AS total FROM outbox_event"))[0]?.total, 1);
  assert.equal((await h.db.query("SELECT count(*) AS total FROM lifecycle_evidence"))[0]?.total, 1);
}

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
  await lockedDepartureRejectsBeforePorts();
});

async function lockedDepartureRejectsBeforePorts() {
  const h = await harness(),
    draft = await begin(h, "relocate");
  await complete(h, draft);
  const retained = () =>
    Promise.all([
      h.db.query("SELECT * FROM lifecycle_draft"),
      h.db.query("SELECT * FROM outbox_event"),
      h.db.query("SELECT * FROM lifecycle_evidence"),
      h.db.query("SELECT * FROM attachment_file"),
    ]);
  const before = await retained();
  const entered = deferred<undefined>(),
    resume = deferred<string>();
  let nativeCalls = 0;
  const service = new LifecycleService({
    ...h.deps,
    shiftId: () => {
      entered.resolve(undefined);
      return resume.promise;
    },
    gps: {
      locate: () => {
        nativeCalls++;
        return Promise.resolve(null);
      },
    },
    evidence: {
      capture: (context: EvidenceCaptureContext) => {
        nativeCalls++;
        return Promise.resolve({
          ...PHOTO,
          authority: h.store.evidenceCaptureGuard(context.draftId),
        });
      },
    },
  });
  const outcomes = Promise.allSettled([
    service.captureEvidence(draft.eventId),
    service.refreshGps(draft.eventId),
  ]);
  await entered.promise;
  await h.credentials.lock();
  assert.equal(
    (await h.service.read()).draft?.eventId,
    draft.eventId,
    "background read identity remains valid while interactive actions are locked",
  );
  resume.resolve(draft.shiftId);
  assert.deepEqual(
    (await outcomes).map((result) => result.status),
    ["rejected", "rejected"],
  );
  assert.equal(
    nativeCalls,
    0,
    "lock during departure authorization must defeat native initiation, including the queued action",
  );
  assert.deepEqual(await retained(), before);
}

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
  assert.equal(
    await hasLocalRecords(local.db),
    false,
    "downloaded projections are cache, not authored owner work",
  );
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
  const source = await h.bundle.captureLifecycleSource()(
    { kind: "new", ovitrapId: next.id },
    (turn) => Promise.resolve(turn.source),
  );
  assert.equal(source?.point.code, POINT.code);
  assert.equal(source.physical.kind, "downloaded");
  const started = await h.service.start(
    { kind: "remove", ovitrapId: next.id, manualCapture: false },
    null,
  );
  assert.equal(started.draft?.schemaVersion, 2);
  assert.equal("assignment" in started.draft, false);
  assert.equal(
    await hasLocalRecords(local.db),
    true,
    "explicit owned draft is protected even before a photo",
  );
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
  await h.outbox.enqueue(
    captureEvent(placed),
    h.store.capture.commitStatements(placed, (await h.store.capture.read()).draftVersion),
  );
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
    ...checkEvidence(h),
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
    await feedbackHostControls(render, source, { h, locale });
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
  await h.source.read(null, (turn) =>
    h.store.saveConfiguration({ catalog: null, rules: null }, turn),
  );
  const draft = await begin(h, "relocate");
  await h.source.read(null, (turn) => h.store.saveConfiguration(config, turn));
  assert.equal((await h.service.read()).catalogChanged, true);
  const adopted = await h.service.adoptSnapshots(draft.eventId);
  assert.equal(adopted.draft?.catalog?.version, config.catalog?.version);
  assert.ok(config.rules);
  const rules = config.rules;
  await h.source.read(null, (turn) =>
    h.store.saveConfiguration({ ...config, rules: { ...rules, version: "rules-v2" } }, turn),
  );
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
    ...checkEvidence(h),
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
      h.outbox.enqueue(
        captureEvent(state.draft),
        h.store.capture.commitStatements(state.draft, (await h.store.capture.read()).draftVersion),
      ),
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
    ...checkEvidence(h),
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
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () =>
      Promise.resolve({
        kind: "bundle",
        body: {
          ...fixtureBundle(ASSIGNMENT),
          bundle_version: "bootstrap-lifecycle",
          schema_version: "schema-1",
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

import { createHash } from "node:crypto";
import { LifecycleAdvisory } from "../src/features/ovitrap-lifecycle/advisory.ts";
import { readAdvisory } from "../src/features/ovitrap-lifecycle/advisory-contract.ts";
import { createScopedApiClient } from "../src/api/create-scoped-api-client.ts";
import { SessionRequests } from "../src/auth/session-requests.ts";
import type { CurrentLifecycleDraft } from "../src/features/ovitrap-lifecycle/types.ts";
function serverHash(value: unknown): string {
  const sorted = (input: unknown): unknown =>
    Array.isArray(input)
      ? input.map(sorted)
      : input !== null && typeof input === "object"
        ? Object.fromEntries(
            Object.keys(input)
              .sort()
              .map((key) => [key, sorted((input as Record<string, unknown>)[key])]),
          )
        : input;
  return createHash("sha256")
    .update(JSON.stringify(sorted(value)))
    .digest("hex");
}
function serverAdvisory(
  draft: CurrentLifecycleDraft,
  count: number,
  future = false,
): Schemas["OvitrapAdvisory"] {
  const content = {
    schema_version: 1,
    physical_ovitrap_id: draft.ovitrapId,
    point_id: draft.point.id,
    as_of: draft.deviceTime,
    ...(future
      ? {
          state: "unavailable",
          unavailable_reason: "future_cutoff",
          rule_context: null,
          rule_context_version: null,
          required_epi_weeks: null,
          observed_closed_house_weeks: null,
          incident_count: null,
          suggested: null,
        }
      : availableServerAdvisory(draft, count)),
  };
  return { ...content, version: serverHash(content) } as Schemas["OvitrapAdvisory"];
}
function availableServerAdvisory(draft: CurrentLifecycleDraft, count: number) {
  const rule = draft.rules?.relocationParameters;
  assert.ok(rule?.closedHouseWeeks && rule.incidents);
  assert.ok(typeof rule.incidents.value === "number");
  const context = {
    timezone: draft.source.organization.timezone,
    epi_week: draft.source.organization.epi_week,
    parameters: {
      closed_house_weeks_to_relocate: rule.closedHouseWeeks,
      incidents_to_relocate: rule.incidents,
    },
  };
  return {
    state: "available",
    unavailable_reason: null,
    rule_context: context,
    rule_context_version: serverHash(context),
    required_epi_weeks: ["2026-W03", "2026-W02"],
    observed_closed_house_weeks: ["2026-W02"],
    incident_count: count,
    suggested: count >= rule.incidents.value,
  };
}
function sessionRequests(credentials: CredentialStore) {
  return new SessionRequests({
    credentials,
    isOnline: () => true,
    refresh: () => Promise.reject(new Error("Unexpected refresh")),
    endSession: () => Promise.resolve(),
  });
}
async function actualAdvisoryJourney(test: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "wolbachia-op03-")),
    path = join(directory, "cache.sqlite");
  let database = await openTestDatabase(path);
  test.after(() => {
    database.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "wolbachia-op03-"));
    rmSync(directory, { recursive: true });
  });
  const h = await harness(storesFor(database.executor));
  await h.source.read(null, async (turn) => {
    const config = await h.store.configuration(turn.handle);
    const parameter = (id: string, value: number) => ({
      version_id: id,
      value,
      effective_from: "2025-01-01T00:00:00Z",
    });
    await h.store.saveConfiguration(
      {
        ...config,
        rules: {
          ...RULES,
          closedHouseWeeks: 2,
          incidents: 3,
          relocationParameters: {
            closedHouseWeeks: parameter("11111111-1111-4111-8111-111111111111", 2),
            incidents: parameter("22222222-2222-4222-8222-222222222222", 3),
          },
        },
      },
      turn,
    );
  });
  const draft = await begin(h, "relocate");
  assert.equal(draft.schemaVersion, 2);
  let body = serverAdvisory(draft, 3),
    unchanged = false,
    offline = false;
  const requests: Request[] = [],
    entered = deferred<undefined>(),
    resume = deferred<undefined>();
  let hold = false,
    badEtag = false,
    denied = false;
  let beforeResponse = () => Promise.resolve();
  const advisory = new LifecycleAdvisory({
    db: h.db,
    requests: sessionRequests(h.credentials),
    client: () =>
      createScopedApiClient({
        tokens: h.credentials,
        fetch: async (request) => {
          const call = new Request(request);
          requests.push(call);
          if (hold) {
            entered.resolve(undefined);
            await resume.promise;
          }
          if (offline) throw new Error("Offline optional advisory");
          await beforeResponse();
          return advisoryHttpResponse(body, { denied, unchanged, badEtag });
        },
      }),
  });
  const service = new LifecycleService({
    ...h.deps,
    refreshAdvisory: (value, turn, operation) => advisory.refresh(value, turn, operation),
  });
  assert.equal((await service.read()).advisory?.state, "unavailable");
  assert.equal((await service.refreshAdvisory(draft.eventId)).advisory?.state, "available");
  const firstRequest = requests[0];
  assert.ok(firstRequest);
  assert.equal(new URL(firstRequest.url).searchParams.get("at"), draft.deviceTime);
  assert.ok(new URL(firstRequest.url).pathname.endsWith("/ovitrap-advisories/" + SOURCE + "/"));
  unchanged = true;
  await service.refreshAdvisory(draft.eventId);
  const secondRequest = requests[1];
  assert.ok(secondRequest);
  assert.equal(secondRequest.headers.get("If-None-Match"), '"' + body.version + '"');
  unchanged = false;
  badEtag = true;
  await assert.rejects(service.refreshAdvisory(draft.eventId));
  badEtag = false;
  const wrongPoint = { ...body, point_id: h.deps.uuid() };
  wrongPoint.version = serverHash(
    Object.fromEntries(Object.entries(wrongPoint).filter(([key]) => key !== "version")),
  );
  body = wrongPoint;
  await assert.rejects(service.refreshAdvisory(draft.eventId));
  body = serverAdvisory(draft, 0); // Late void at the SAME cutoff changes the observed aggregate/version.
  const updated = await service.refreshAdvisory(draft.eventId);
  assert.ok(updated.advisory?.state === "available");
  assert.equal(updated.advisory.body.incident_count, 0);
  body = serverAdvisory(draft, 0, true);
  assert.deepEqual((await service.refreshAdvisory(draft.eventId)).advisory, {
    state: "unavailable",
    reason: "future_cutoff",
  });
  body = serverAdvisory(draft, 3); // Controlled server-clock transition, without projection writes.
  assert.equal((await service.refreshAdvisory(draft.eventId)).advisory?.state, "available");
  const cold = new LifecycleService(h.deps);
  assert.equal((await cold.read()).advisory?.state, "available");
  offline = true;
  await assert.rejects(service.refreshAdvisory(draft.eventId));
  offline = false;
  assert.equal(
    (await cold.read()).advisory?.state,
    "available",
    "An ordinary offline refresh retains the exact proven observation",
  );
  const malformed = { ...body, incident_count: null };
  malformed.version = serverHash(
    Object.fromEntries(Object.entries(malformed).filter(([key]) => key !== "version")),
  );
  assert.throws(() => readAdvisory(malformed));
  hold = true;
  const late = service.refreshAdvisory(draft.eventId);
  await entered.promise;
  const captured = await h.db.query("SELECT draft FROM lifecycle_draft");
  await h.bundle.applyProjectionChanges(projectionChanges());
  resume.resolve(undefined);
  await assert.rejects(late);
  assert.equal((await cold.read()).advisory?.state, "unavailable");
  assert.deepEqual(await h.db.query("SELECT draft FROM lifecycle_draft"), captured);
  assert.deepEqual(await h.db.query("SELECT * FROM outbox_event"), []);
  hold = false;
  await hydrateLifecycleCaptureFixture(
    h.db,
    { ...ASSIGNMENT, ovitraps: [{ id: SOURCE, point: POINT }] },
    { force: true },
  );
  await new AttachmentStore(h.db).bindSession(PROJECTION_IDENTITY);
  assert.equal((await service.refreshAdvisory(draft.eventId)).advisory?.state, "available");
  denied = true;
  await advisoryErrorJourney(h, service, {
    eventId: draft.eventId,
    holdResponse: (wait) => {
      beforeResponse = wait;
    },
  });
  assert.equal(
    h.credentials.getSnapshot().status,
    "active",
    "permission_denied does not end SessionRequests",
  );
  const suppressed = await cold.read();
  assert.ok(suppressed.advisory);
  assert.equal(suppressed.advisory.state, "unavailable", "Observed403 suppresses retained cache");
  database.close();
  database = await openTestDatabase(path);
  const db = database.executor,
    store = new LifecycleStore(db);
  const bundle = new DayBundleService({
    store: new DayStore(db),
    now: () => FIXED_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.reject(new Error("No bootstrap needed for a proven file reopen")),
  });
  const source = createLifecycleSourcePort(bundle, h.credentials, db);
  const reopened = new LifecycleService({ ...h.deps, source, store });
  assert.equal(
    (await reopened.read()).advisory?.state,
    "unavailable",
    "Observed403 suppression survives actual SQLite close/reopen",
  );
}

import type { TestContext } from "node:test";
import { attachmentHarness, PNG_BYTES } from "./support/attachment-fixtures.ts";
import { EvidenceCapture } from "../src/attachments/capture-evidence.ts";
import { AttachmentSync } from "../src/attachments/attachment-sync.ts";
import { PrivateAttachmentTransport } from "../src/attachments/attachment-transport.ts";
import { attachmentSyncHooks } from "../src/attachments/sync-hooks.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { lifecycleEvidence } from "../src/features/ovitrap-lifecycle/evidence-configuration.ts";
import { createPhotoAcquisitionPort } from "../src/attachments/photo-acquisition.ts";
import { pathToFileURL } from "node:url";
import { ConcurrentCaptureError } from "../src/features/ovitrap-check/capture-identity.ts";
import { actionErrorKey as lifecycleErrorKey } from "../src/features/ovitrap-lifecycle/action-error-key.ts";
/** Same AC3 transaction owner: native/file adoption and whole-draft writers share one arbiter. */
async function lifecyclePhotoWriterArbitration(test: TestContext) {
  await lifecyclePhotoEditorOrder(test, "editor-first");
  await lifecyclePhotoEditorOrder(test, "photo-first");
  await lifecyclePhotoStaleSave(test);
}
async function lifecyclePhotoFixture(test: TestContext) {
  const local = await attachmentHarness(test);
  local.setIdentity(PROJECTION_IDENTITY);
  const h = await harness(local);
  let camera: () => Promise<void> = () => Promise.resolve();
  let cancelNext = false;
  const evidence = lifecycleEvidence({
    store: h.store,
    attachments: {
      capture: new EvidenceCapture(local),
      session: local.session,
      store: local.store,
    },
    port: createPhotoAcquisitionPort({
      uuid: h.deps.uuid,
      canStart: () => true,
      picker: {
        getPendingResultAsync: () => Promise.resolve(null),
        getCameraPermissionsAsync: () => Promise.resolve({ granted: true, canAskAgain: true }),
        requestCameraPermissionsAsync: () =>
          Promise.reject(new Error("Unexpected permission request")),
        launchCameraAsync: async () => {
          await camera();
          if (cancelNext) {
            cancelNext = false;
            return { canceled: true, assets: null };
          }
          return {
            canceled: false,
            assets: [{ uri: pathToFileURL(local.source).href, width: 1, height: 1 }],
          };
        },
      },
    }),
  });
  const service = new LifecycleService({ ...h.deps, ...evidence });
  const state = await service.start(
    { kind: "relocate", ovitrapId: SOURCE, manualCapture: false },
    null,
  );
  assert.ok(state.draft);
  const eventId = state.draft.eventId;
  await service.update({ reasonCode: "closed-house" }, eventId);
  await service.refreshGps(eventId);
  return {
    h,
    local,
    evidence,
    service,
    eventId,
    cancelNext: () => {
      cancelNext = true;
    },
    holdCamera: (callback: typeof camera) => {
      camera = callback;
    },
  };
}
async function lifecyclePhotoEditorOrder(test: TestContext, order: "editor-first" | "photo-first") {
  const f = await lifecyclePhotoFixture(test);
  const entered = deferred<undefined>(),
    resume = deferred<undefined>();
  let checks = 0;
  const editor = new LifecycleService({
    ...f.h.deps,
    shiftId: async () => {
      if (order === "photo-first" && ++checks === 2) {
        entered.resolve(undefined);
        await resume.promise;
      }
      return f.h.deps.shiftId();
    },
  });
  editor.draftBuffer.edit(f.eventId, { otherText: "recoverable editor input" });
  if (order === "editor-first") {
    f.holdCamera(async () => {
      entered.resolve(undefined);
      await resume.promise;
    });
    const photo = f.service.captureEvidence(f.eventId);
    await entered.promise;
    await editor.draftBuffer.persist(editor, f.eventId);
    resume.resolve(undefined);
    await photo;
  } else {
    const edit = editor.draftBuffer.persist(editor, f.eventId);
    const rejected = assert.rejects(edit, (error) => {
      assert.ok(error instanceof ConcurrentCaptureError);
      assert.equal(lifecycleErrorKey(error), "mobile.ovitrap.concurrentEdit");
      return true;
    });
    await entered.promise;
    await f.service.captureEvidence(f.eventId);
    resume.resolve(undefined);
    await rejected;
    assert.equal(
      editor.draftBuffer.merge(await editor.read()).draft?.otherText,
      "recoverable editor input",
    );
    assert.equal((await f.h.store.read()).draft?.otherText, "");
    await editor.draftBuffer.persist(editor, f.eventId); // Explicit user retry; no automatic replay.
  }
  const stored = await f.h.store.read();
  assert.equal(stored.draft?.otherText, "recoverable editor input");
  assert.equal(stored.draft.evidence.length, 1);
  assert.deepEqual(Object.keys(stored.draft.evidence[0] ?? {}).sort(), ["fileRef", "id"]);
  assert.equal((await f.local.db.query("SELECT * FROM attachment_file")).length, 1);
  assert.deepEqual(await f.local.db.query("SELECT * FROM attachment_event"), []);
  assert.deepEqual(await f.local.db.query("SELECT * FROM outbox_event"), []);
}
async function lifecyclePhotoStaleSave(test: TestContext) {
  const f = await lifecyclePhotoFixture(test);
  const original = (await f.h.store.read()).draft;
  f.cancelNext();
  assert.deepEqual((await f.service.captureEvidence(f.eventId)).draft, original);
  assert.deepEqual(await f.local.db.query("SELECT * FROM attachment_file"), []);
  await f.service.captureEvidence(f.eventId);
  const entered = deferred<undefined>(),
    resume = deferred<undefined>();
  let held = false;
  const saving = new LifecycleService({
    ...f.h.deps,
    ...f.evidence,
    evidenceBindings: async (draft, turn) => {
      const statements = await f.evidence.evidenceBindings(draft, turn);
      if (!held) {
        held = true;
        entered.resolve(undefined);
        await resume.promise;
      }
      return statements;
    },
  });
  const pending = saving.save(f.eventId);
  const rejected = assert.rejects(pending, /could not be saved/);
  await entered.promise;
  await f.service.captureEvidence(f.eventId);
  const before = await f.local.db.query("SELECT draft,event_id FROM lifecycle_draft");
  resume.resolve(undefined);
  await rejected;
  assert.deepEqual(await f.local.db.query("SELECT draft,event_id FROM lifecycle_draft"), before);
  for (const table of [
    "outbox_event",
    "lifecycle_capture",
    "lifecycle_evidence",
    "attachment_event",
  ])
    assert.deepEqual(await f.local.db.query(`SELECT * FROM ${table}`), []);
  await saving.save(f.eventId); // The explicit retry reads and binds BOTH original adopted UUIDs.
  const state = await f.h.store.read();
  assert.equal(state.event?.envelope.id, f.eventId);
  assert.deepEqual(
    state.event.envelope.payload.evidence_ids,
    state.draft?.evidence.map((item) => item.id),
  );
  assert.equal((await f.local.db.query("SELECT * FROM attachment_event")).length, 2);
}
async function actualEvidenceJourney(test: TestContext) {
  const local = await attachmentHarness(test);
  local.setIdentity(PROJECTION_IDENTITY);
  const h = await harness(local),
    sent: string[] = [],
    uploaded: string[] = [];
  const capture = new EvidenceCapture(local),
    id = h.deps.uuid(),
    discarded = h.deps.uuid();
  const ids = [discarded, id];
  let cursor = 0,
    nativeCalls = 0,
    active = false;
  const requests = sessionRequests(h.credentials);
  const transport = new PrivateAttachmentTransport({
    requests,
    assertCurrent: local.session.assertCurrent.bind(local.session),
    requireActor: local.session.requireActor.bind(local.session),
    requireAttempt: (call) =>
      local.store.requireAttempt({
        id: call.file.id,
        fence: call.fence,
        attemptVersion: call.attemptVersion,
      }),
    client: () =>
      createScopedApiClient({
        tokens: h.credentials,
        fetch: async (request) => {
          const call = new Request(request),
            url = new URL(call.url);
          if (url.pathname.endsWith("/content/")) {
            assert.deepEqual(Buffer.from(await call.arrayBuffer()), PNG_BYTES);
            return new Response(null, { status: 204 });
          }
          if (url.pathname.endsWith("/finalize/"))
            return Response.json({ id, state: "verified", verified_at: FIXED_NOW.toISOString() });
          const body = (await call.json()) as Record<string, unknown>;
          assert.equal(body.client_id, id);
          uploaded.push(body.client_id);
          assert.equal(body.sha256, createHash("sha256").update(PNG_BYTES).digest("hex"));
          return Response.json({
            upload_id: id,
            url: "/api/v1/field/uploads/" + id + "/content/",
            method: "PUT",
            headers: { "Content-Type": "image/png", "Upload-Lease": "synthetic-lease" },
            expires_at: "2026-01-16T12:00:00Z",
          });
        },
      }),
  });
  const sync = new AttachmentSync({ ...local, transport, now: () => FIXED_NOW });
  const engine = new SyncEngine({
    pass: {
      ...local,
      deviceId: PROJECTION_IDENTITY.owner.deviceId,
      now: () => FIXED_NOW,
      attachments: attachmentSyncHooks({ ...local, sync }),
      transport: (batch) => {
        sent.push(...batch.events.map((event) => event.id));
        return Promise.resolve(answer(batch.events.map((event) => accepted(event.id))));
      },
    },
    hasSession: () => active,
    hasServer: () => true,
    hasPendingFinalUpload: () => Promise.resolve(false),
    random: () => 0,
    schedule: () => () => undefined,
    report: (error) => {
      throw error;
    },
  });
  const service = new LifecycleService({
    ...h.deps,
    engine,
    ...lifecycleEvidence({
      store: h.store,
      port: createPhotoAcquisitionPort({
        uuid: () => {
          const photoId = ids[cursor++];
          assert.ok(photoId);
          return photoId;
        },
        canStart: () => true,
        picker: {
          getPendingResultAsync: () => Promise.resolve(null),
          getCameraPermissionsAsync: () => Promise.resolve({ granted: true, canAskAgain: true }),
          requestCameraPermissionsAsync: () =>
            Promise.reject(new Error("Unexpected permission request")),
          launchCameraAsync: () => {
            nativeCalls++;
            return Promise.resolve({
              canceled: false,
              assets: [{ uri: pathToFileURL(local.source).href, width: 1, height: 1 }],
            });
          },
        },
      }),
      attachments: { capture, session: local.session, store: local.store },
    }),
  });
  const start = await service.start(
    { kind: "relocate", ovitrapId: SOURCE, manualCapture: false },
    null,
  );
  assert.ok(start.draft);
  const eventId = start.draft.eventId;
  await service.update({ reasonCode: "closed-house" }, eventId);
  await service.refreshGps(eventId);
  await heldEvidenceAdmission({ h, local, service, eventId, nativeCalls: () => nativeCalls });
  await service.captureEvidence(eventId);
  await service.captureEvidence(eventId);
  await service.removeEvidence(discarded, eventId);
  await service.undoEvidence(eventId);
  await service.removeEvidence(discarded, eventId);
  assert.equal(
    await sync.advanceOne(),
    false,
    "Adoption in a draft is not enrollment or consent to transmit",
  );
  assert.deepEqual(await local.db.query("SELECT * FROM attachment_event"), []);
  await local.db.runAtomically([
    {
      sql: "CREATE TRIGGER m09_storage_fail BEFORE INSERT ON lifecycle_capture BEGIN SELECT RAISE(ABORT,'full'); END",
    },
  ]);
  await assert.rejects(service.save(eventId));
  assert.deepEqual(await local.db.query("SELECT * FROM attachment_event"), []);
  assert.deepEqual(await local.db.query("SELECT * FROM outbox_event"), []);
  assert.equal((await local.db.query("SELECT id FROM attachment_file")).length, 2);
  await local.db.runAtomically([{ sql: "DROP TRIGGER m09_storage_fail" }]);
  await service.save(eventId);
  const original = (await h.store.read()).event?.envelope;
  assert.deepEqual(original?.payload.evidence_ids, [id]);
  assert.deepEqual(await local.outbox.claimPending(50, await local.session.selection()), []);
  active = true;
  engine.setOnline(true);
  await engine.requestSync();
  await engine.requestSync();
  assert.deepEqual(uploaded, [id]);
  assert.deepEqual(sent, [eventId]);
  assert.equal((await h.store.read()).event?.status, "sent");
  assert.deepEqual((await h.store.read()).event?.envelope, original);
  assert.equal(
    await local.store.next(await local.session.capture(), FIXED_NOW.toISOString()),
    null,
  );
  const savedDraft = (await h.store.read()).draft;
  assert.ok(savedDraft);
  await h.bundle.applyProjectionChanges(
    projectionChanges({
      history: [
        historyChange(
          proposalHistory(savedDraft, {
            id: h.deps.uuid(),
            proposalEventId: eventId,
            status: "approved",
            reason: null,
            decidedAt: null,
            nextDayTask: null,
          }),
        ),
      ],
    }),
  );
  const reopened = await local.reopen();
  const restarted = await harness(reopened);
  assert.equal((await restarted.service.read()).proposal?.status, "approved");
  assert.deepEqual((await new LifecycleStore(reopened.db).read()).event?.envelope, original);
  assert.equal(
    (await reopened.db.query("SELECT id FROM attachment_file WHERE id=?", [discarded])).length,
    1,
  );
}

import { ForegroundLifecycleGps } from "../src/features/ovitrap-lifecycle/foreground-gps.ts";
import type { LocationState } from "../src/features/day/location.ts";
async function foregroundGpsLifecycle() {
  let active = true,
    stopped = 0,
    timerStopped = 0,
    listenerStopped = 0;
  let publish: (state: LocationState) => void = () => undefined,
    background: () => void = () => undefined,
    timeout: () => void = () => undefined;
  const watcher = deferred<() => void>(),
    entered = deferred<undefined>();
  const gps = new ForegroundLifecycleGps({
    source: {
      start: (callback) => {
        publish = callback;
        entered.resolve(undefined);
        return watcher.promise;
      },
    },
    now: () => FIXED_NOW,
    activity: {
      isActive: () => active,
      subscribe: (callback) => {
        background = callback;
        return () => {
          listenerStopped++;
        };
      },
    },
    schedule: (callback) => {
      timeout = callback;
      return () => {
        timerStopped++;
      };
    },
  });
  const locating = gps.locate();
  await entered.promise;
  publish({
    kind: "granted",
    fix: { lat: 19, lng: -99, accuracy_m: 4, fixedAt: FIXED_NOW.getTime() - 61_000 },
  });
  active = false;
  background();
  assert.equal(await locating, null);
  watcher.resolve(() => {
    stopped++;
  });
  await watcher.promise;
  await Promise.resolve();
  publish({
    kind: "granted",
    fix: { lat: 20, lng: -100, accuracy_m: 4, fixedAt: FIXED_NOW.getTime() },
  });
  assert.deepEqual([stopped, timerStopped, listenerStopped], [1, 1, 1]);
  active = true;
  const bounded = gps.locate();
  timeout();
  assert.equal(await bounded, null);
  const synchronous = new ForegroundLifecycleGps({
    source: {
      start: (callback) => {
        callback({
          kind: "granted",
          fix: { lat: 19, lng: -99, accuracy_m: 75, fixedAt: FIXED_NOW.getTime() },
        });
        return Promise.resolve(() => {
          stopped++;
        });
      },
    },
    now: () => FIXED_NOW,
    activity: { isActive: () => true, subscribe: () => () => undefined },
    schedule: () => () => undefined,
  });
  assert.deepEqual(
    await synchronous.locate(),
    { lat: 19, lng: -99, accuracy_m: 75 },
    "Accuracy is real; the frozen rule/save gate decides review, never this adapter",
  );
}

import { REVIEW_HISTORY, SHIFT_HISTORY } from "./support/lifecycle-contract-fixtures.ts";
async function currentFeedbackActions(
  h: Awaited<ReturnType<typeof harness>>,
  draft: LifecycleDraft,
  decision: RelocationDecision,
) {
  const original = (await h.store.read()).event?.envelope;
  await h.outbox.claimPending(50);
  await h.outbox.settle([
    { id: draft.eventId, action: "review", result: { code: "clock_skew", params: {} } },
  ]);
  const receipt = (await h.store.read()).event;
  const review = { ...REVIEW_HISTORY, id: h.deps.uuid(), source_event_id: draft.eventId };
  const shift = {
    ...SHIFT_HISTORY,
    id: h.deps.uuid(),
    source_event_id: null,
    shift_id: draft.shiftId,
  };
  const remote = {
    ...proposalHistory(draft, { ...decision, decidedAt: null, reason: null }),
    id: h.deps.uuid(),
    proposal_event_id: h.deps.uuid(),
    source_voided_at: "2026-01-16T15:00:00Z",
  };
  await h.bundle.applyProjectionChanges(
    projectionChanges({
      history: [historyChange(review), historyChange(shift), historyChange(remote)],
    }),
  );
  const observed = await h.service.read();
  assert.equal(observed.reviews?.length, 2);
  assert.equal(
    observed.reviews.find((entry) => entry.kind === "shift_validation")?.approval_current,
    false,
  );
  assert.equal(observed.remoteProposals?.[0]?.decision?.decided_at, null);
  assert.deepEqual(
    observed.event,
    receipt,
    "Actual B33 feedback never rewrites the original ingest receipt/envelope",
  );
  assert.deepEqual(observed.event?.envelope, original);
  const adopted = { ...review, id: h.deps.uuid(), effect_state: "adopted_legacy" as const };
  const incident = {
    ...review,
    id: h.deps.uuid(),
    decision_kind: "open_incident" as const,
    is_terminal: false,
    decision_state: "pending" as const,
    effect_state: "incident_open" as const,
    incident_id: h.deps.uuid(),
  };
  await h.bundle.applyProjectionChanges(
    projectionChanges({ history: [historyChange(adopted), historyChange(incident)] }),
  );
  const effects = (await h.service.read()).reviews;
  assert.ok(effects);
  assert.ok(effects.some((entry) => entry.effect_state === "adopted_legacy"));
  assert.ok(
    effects.some((entry) => entry.effect_state === "incident_open" && entry.is_terminal === false),
  );
  await currentTaskActions(h, draft, decision);
  assert.deepEqual((await h.service.read()).event, receipt);
  assert.equal((await h.db.query("SELECT * FROM lifecycle_capture")).length, 1);
}

async function feedbackHostControls(
  render: ReturnType<typeof componentHarness>,
  draft: LifecycleDraft,
  input: { h: Awaited<ReturnType<typeof harness>>; locale: "es-MX" | "en" },
) {
  const { h, locale } = input;
  const model = {
    state: {
      ...(await h.service.read()),
      frameState: "closed",
      advisory: { state: "unavailable", reason: "future_cutoff" },
    },
    isBusy: false,
    run: () => Promise.resolve(true),
    service: h.service,
  };
  const nodes = render.render(
    "mobile/src/features/ovitrap-lifecycle/AdvisoryFeedback.tsx",
    "AdvisoryFeedback",
    { model, draft },
  );
  const retry = nodes.find((node) => node.type === "Pressable");
  assert.equal(retry?.props.accessibilityLabel, messages[locale]["common.actions.retry"]);
  assert.ok(Number(flattenStyle(retry.props.style).minHeight) >= 48);
  const review = render.render(
    "mobile/src/features/ovitrap-lifecycle/ReviewedOutcome.tsx",
    "ReviewedOutcome",
    { entry: { ...SHIFT_HISTORY, is_terminal: false } },
  );
  const text = review.filter((node) => node.type === "Text").map((node) => node.props.children);
  assert.ok(text.includes(messages[locale]["mobile.lifecycle.approvalNotCurrent"]));
  assert.ok(text.includes(messages[locale]["mobile.lifecycle.nonterminalDecision"]));
  const proposal = {
    eventId: draft.eventId,
    status: "rejected",
    proposedLocation: [-99, 19],
    isVoided: false,
    decision: {
      id: h.deps.uuid(),
      proposalEventId: draft.eventId,
      status: "rejected",
      decidedAt: null,
      reason: null,
      nextDayTask: null,
    },
    nextDayTask: { id: h.deps.uuid(), code: "ACTUAL-TASK", dueDate: "2026-01-17" },
    isTaskActionable: false,
  };
  let opened = 0;
  const passive = render.render(
    "mobile/src/features/ovitrap-lifecycle/ProposalFeedback.tsx",
    "ProposalFeedback",
    {
      proposal,
      openTask: () => {
        opened++;
      },
    },
  );
  assert.equal(
    passive.some((node) => node.type === "Pressable"),
    false,
  );
  assert.ok(
    passive.some(
      (node) => node.props.children === messages[locale]["mobile.lifecycle.decisionTimeUnknown"],
    ),
  );
  const actionable = render.render(
    "mobile/src/features/ovitrap-lifecycle/ProposalFeedback.tsx",
    "ProposalFeedback",
    {
      proposal: { ...proposal, isTaskActionable: true },
      openTask: () => {
        opened++;
      },
    },
  );
  const button = actionable.find((node) => node.type === "Pressable");
  assert.equal(button?.props.accessibilityLabel, messages[locale]["mobile.lifecycle.openTask"]);
  assert.ok(button);
  assert.equal(typeof button.props.onPress, "function");
  (button.props.onPress as () => void)();
  assert.equal(opened, 1);
  const closed = render.render(
    "mobile/src/features/ovitrap-lifecycle/AvailabilityNotices.tsx",
    "AvailabilityNotices",
    { model },
  );
  assert.ok(
    closed.some((node) => node.props.children === messages[locale]["mobile.lifecycle.epochClosed"]),
  );
}

async function currentTaskActions(
  h: Awaited<ReturnType<typeof harness>>,
  draft: LifecycleDraft,
  decision: RelocationDecision,
) {
  assert.equal((await h.service.read()).proposal?.isTaskActionable, false);
  let selected = 0;
  const day = taskDay(h);
  const service = new LifecycleService({
    ...h.deps,
    selectTask: async (id, expected, admission) => {
      await day.select(id, expected, admission);
      selected++;
    },
  });
  await assert.rejects(service.openTask(draft.eventId));
  assert.ok(decision.nextDayTask);
  const task = {
    kind: "task",
    id: decision.nextDayTask.id,
    code: decision.nextDayTask.code,
    point: draft.point.id,
    quadrant_id: draft.point.id,
    courier: PROJECTION_IDENTITY.owner.userId,
    action: "check",
    category: "normal",
    revision: 1,
    date: decision.nextDayTask.dueDate,
    is_completed: false,
  };
  let sequence = 20;
  const publish = (patch: Record<string, unknown>, removed = false) =>
    h.bundle.applyProjectionChanges(
      projectionChanges({
        assignments: [
          {
            sequence: ++sequence,
            action: removed ? "remove" : "upsert",
            resource_type: "assignment",
            resource_id: task.id,
            resource_version: String(sequence),
            data: { ...task, ...patch, revision: sequence },
          },
        ],
      }),
    );
  await publish({});
  assert.equal((await service.read()).proposal?.isTaskActionable, true);
  await service.openTask(draft.eventId);
  assert.equal(selected, 1);
  await heldTaskAdmission(h, service, draft.eventId);
  for (const patch of [
    { is_completed: true },
    { courier: h.deps.uuid() },
    { point: h.deps.uuid() },
    { is_completed: undefined },
  ]) {
    await publish(patch);
    assert.equal((await service.read()).proposal?.isTaskActionable, false);
    await assert.rejects(service.openTask(draft.eventId));
  }
  await publish({}, true);
  assert.equal((await service.read()).proposal?.isTaskActionable, false);
  assert.equal(selected, 1);
}

async function correctionOptionJourney() {
  for (const sample of [
    { code: "mistake", text: "", valid: true },
    { code: "mistake", text: "short", valid: true },
    { code: "other", text: "short", valid: false },
    { code: "other", text: "abcdefghij", valid: true },
  ]) {
    const h = await harness(),
      draft = await begin(h, "relocate");
    await complete(h, draft);
    await h.service.save(draft.eventId);
    await h.source.read(null, async (turn) => {
      const config = await h.store.configuration(turn.handle);
      assert.ok(config.catalog);
      await h.store.saveConfiguration(
        {
          ...config,
          catalog: { ...config.catalog, voidReasons: [reason("mistake"), reason("other")] },
          limits: { void_reason_min_length: 10, void_reason_max_length: 40 },
        },
        turn,
      );
    });
    if (sample.code === "mistake" && sample.text === "") {
      await assert.rejects(
        h.service.correct({ reasonCode: sample.code, reason: "x".repeat(41) }, draft.eventId),
      );
      await assert.rejects(
        h.service.correct({ reasonCode: sample.code, reason: "short\u202e" }, draft.eventId),
      );
    }
    const original = (await h.store.read()).event?.envelope;
    const corrected = h.service.correct(
      { reasonCode: sample.code, reason: sample.text },
      draft.eventId,
    );
    if (!sample.valid) {
      await assert.rejects(corrected);
      assert.deepEqual(await h.db.query("SELECT * FROM lifecycle_void"), []);
    } else {
      await corrected;
      assert.equal((await h.store.read()).history[0]?.voidReason, sample.text);
    }
    assert.deepEqual((await h.store.read()).event?.envelope, original);
  }
}

import { DayService } from "../src/features/day/service.ts";
import { NavigationService } from "../src/navigation/navigation-service.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { OutboxWorkOverlay } from "../src/features/day/local-work.ts";
function taskDay(h: Awaited<ReturnType<typeof harness>>) {
  return new DayService({
    bundle: h.bundle,
    kv: h.kv,
    navigation: new NavigationService({
      kv: h.kv,
      now: () => FIXED_NOW,
      launcher: {
        launch: () => Promise.reject(new Error("No native directions in task selection")),
      },
    }),
    shift: new ShiftOpenStore(h.db),
    work: new OutboxWorkOverlay(h.db),
    location: { start: () => Promise.reject(new Error("Unused location")) },
    maps: { prepare: () => Promise.reject(new Error("Unused maps")) },
    inspect: () => Promise.reject(new Error("Unused map IO")),
    hasOpenShift: () => Promise.resolve(true),
  });
}
async function heldTaskAdmission(
  h: Awaited<ReturnType<typeof harness>>,
  service: LifecycleService,
  eventId: string,
) {
  const actual = h.dayStore.currentTask.bind(h.dayStore);
  for (const change of ["lock", "cancel"] as const) {
    const entered = deferred<undefined>(),
      resume = deferred<undefined>();
    const before = await h.kv.get("day_navigation");
    h.dayStore.currentTask = async (id, expected) => {
      const row = await actual(id, expected);
      entered.resolve(undefined);
      await resume.promise;
      return row;
    };
    const pending = service.openTask(eventId);
    await entered.promise;
    const locked = change === "lock" ? h.credentials.lock() : Promise.resolve();
    if (change === "cancel") service.cancelInteraction();
    resume.resolve(undefined);
    await assert.rejects(pending);
    await locked;
    assert.equal(
      await h.kv.get("day_navigation"),
      before,
      "A losing original interaction cannot select after its held task SQL",
    );
    await h.credentials.runExclusive((transaction) => {
      transaction.grantUnlock(h.credentials.unlockGate());
    });
  }
  h.dayStore.currentTask = actual;
}
async function heldEvidenceAdmission(input: {
  h: Awaited<ReturnType<typeof harness>>;
  local: Awaited<ReturnType<typeof attachmentHarness>>;
  service: LifecycleService;
  eventId: string;
  nativeCalls: () => number;
}) {
  const { h, local, service, eventId } = input,
    actual = local.store.bindSession.bind(local.store);
  for (const change of ["lock", "cancel"] as const) {
    const entered = deferred<undefined>(),
      resume = deferred<undefined>();
    const before = await h.db.query("SELECT draft FROM lifecycle_draft");
    local.store.bindSession = async (identity, isLogin) => {
      const fence = await actual(identity, isLogin);
      entered.resolve(undefined);
      await resume.promise;
      return fence;
    };
    const pending = service.captureEvidence(eventId);
    await entered.promise;
    if (change === "lock") await h.credentials.lock();
    else service.cancelInteraction();
    resume.resolve(undefined);
    await assert.rejects(pending);
    assert.equal(
      input.nativeCalls(),
      0,
      "Lock/cancel during the actual246 bind must start ZERO native ports",
    );
    assert.deepEqual(await h.db.query("SELECT draft FROM lifecycle_draft"), before);
    assert.deepEqual(await h.db.query("SELECT * FROM outbox_event"), []);
    assert.deepEqual(await h.db.query("SELECT * FROM attachment_file"), []);
    await h.credentials.runExclusive((transaction) => {
      transaction.grantUnlock(h.credentials.unlockGate());
    });
  }
  local.store.bindSession = actual;
}
async function refreshCompletionJourney() {
  for (const change of ["cancel", "bundle", "edit"] as const) {
    const h = await harness(),
      draft = await begin(h, "relocate"),
      entered = deferred<undefined>(),
      resume = deferred<undefined>();
    let pushes = 0;
    const pending = runLifecycleAction(
      {
        service: h.service,
        setError: () => undefined,
        isCurrentView: () => true,
        onSuccess: () => {
          pushes++;
        },
        refresh: async (completion) => {
          entered.resolve(undefined);
          await resume.promise;
          const revision = h.service.draftBuffer.revision,
            snapshot = await h.service.read();
          h.service.draftBuffer.merge(snapshot);
          completion?.normalize(revision, snapshot.draft?.eventId ?? null);
        },
      },
      () => h.service.refreshGps(draft.eventId),
      draft.eventId,
    );
    await entered.promise;
    if (change === "cancel") h.service.cancelInteraction();
    else if (change === "edit")
      h.service.draftBuffer.edit(draft.eventId, { otherText: "Later user input" });
    else
      await h.bundle.applyProjectionChanges(
        projectionChanges({ capture_context: fixtureBundle(ASSIGNMENT).capture_context }),
      );
    resume.resolve(undefined);
    assert.equal(
      await pending,
      false,
      "The same original completion must still be current AFTER refresh",
    );
    assert.equal(pushes, 0);
    assert.ok(
      (await h.store.read()).draft?.gps,
      "A valid earlier GPS commit is retained, never rolled back by a late UI loss",
    );
  }
  const h = await harness(),
    draft = await begin(h, "relocate");
  await complete(h, draft);
  let closed = 0;
  assert.equal(
    await runLifecycleAction(
      {
        service: h.service,
        setError: () => undefined,
        isCurrentView: () => true,
        onSuccess: () => {
          closed++;
        },
        refresh: async (completion) => {
          const revision = h.service.draftBuffer.revision,
            snapshot = await h.service.read();
          h.service.draftBuffer.merge(snapshot);
          completion?.normalize(revision, snapshot.draft?.eventId ?? null);
        },
      },
      () => h.service.save(draft.eventId),
      draft.eventId,
    ),
    true,
  );
  assert.equal(
    closed,
    1,
    "The winner closes after its OWN saved-buffer normalization, without recapturing an actor",
  );
  assert.ok((await h.store.read()).event);
}

function advisoryHttpResponse(
  body: Schemas["OvitrapAdvisory"],
  options: { denied: boolean; unchanged: boolean; badEtag: boolean },
): Response {
  if (options.denied)
    return Response.json(
      { code: "permission_denied", detail: "Denied", params: {} },
      { status: 403 },
    );
  return new Response(options.unchanged ? null : JSON.stringify(body), {
    status: options.unchanged ? 304 : 200,
    headers: {
      "content-type": "application/json",
      ETag: '"' + (options.badEtag ? "f".repeat(64) : body.version) + '"',
    },
  });
}

type AdvisoryInterruption = "none" | "cancel" | "lock" | "cancel-before-response";
interface AdvisoryActionInput {
  eventId: string;
  holdResponse: (wait: () => Promise<void>) => void;
}
async function advisoryErrorJourney(
  h: Awaited<ReturnType<typeof harness>>,
  service: LifecycleService,
  input: AdvisoryActionInput,
) {
  for (const change of ["none", "cancel", "lock", "cancel-before-response"] as const)
    await deniedAdvisoryAction(h, service, { ...input, change });
}
async function deniedAdvisoryAction(
  h: Awaited<ReturnType<typeof harness>>,
  service: LifecycleService,
  input: AdvisoryActionInput & { change: AdvisoryInterruption },
) {
  const { change } = input;
  const entered = deferred<undefined>(),
    resume = deferred<undefined>();
  let publications = 0,
    errors = 0;
  const displayed = { state: "available" };
  input.holdResponse(async () => {
    if (change !== "cancel-before-response") return;
    entered.resolve(undefined);
    await resume.promise;
  });
  const pending = runLifecycleAction(
    {
      service,
      isCurrentView: () => true,
      setError: (key) => {
        if (key) errors++;
      },
      refresh: async (completion) => {
        if (change !== "none") entered.resolve(undefined);
        if (change !== "none") await resume.promise;
        const saved = await service.read();
        if (!completion) throw new Error("A denied request must carry its ORIGINAL completion");
        await completion.complete(
          () => true,
          () => {
            assert.ok(saved.advisory);
            displayed.state = saved.advisory.state;
            publications++;
          },
        );
      },
    },
    () => service.refreshAdvisory(input.eventId),
    input.eventId,
  );
  if (change !== "none") {
    await entered.promise;
    if (change === "lock") await h.credentials.lock();
    else service.cancelInteraction();
    resume.resolve(undefined);
  }
  assert.equal(await pending, false);
  assert.equal(publications, change === "none" ? 1 : 0);
  assert.equal(displayed.state, change === "none" ? "unavailable" : "available");
  assert.equal(errors, change === "none" ? 1 : 0);
  await h.credentials.runExclusive((tx) => tx.grantUnlock(h.credentials.unlockGate()));
}
