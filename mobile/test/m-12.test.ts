import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createApiClient } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { IncidentService } from "../src/features/incidents/service.ts";
import { IncidentStore } from "../src/features/incidents/store.ts";
import { IncidentError } from "../src/features/incidents/domain.ts";
import { setStatement } from "../src/db/kv-store.ts";
import { hasLocalRecords } from "../src/db/owner-data.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import type { SyncBatchRequest } from "../src/sync/sync-transport.ts";
import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";
import type { EvidencePort } from "../src/features/ovitrap-check/types.ts";
import { receiptHarness, receiptId, RECEIPT_PROFILE } from "./support/m-05-fixtures.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";
import { NOW } from "./support/attachment-fixtures.ts";
import { deferred } from "./support/auth-fakes.ts";
import { answer } from "./support/scripted-transport.ts";
import { attachmentSyncHooks } from "../src/attachments/sync-hooks.ts";
import { makeEnvelope } from "./support/factories.ts";
import { readIncidentShift } from "../src/features/incidents/shift.ts";
import type { IncidentGps } from "../src/features/incidents/types.ts";
import type { IncidentRemote } from "../src/features/incidents/remote.ts";
import { reportedIncident } from "./support/incident-fixtures.ts";

const PROFILE = {
  ...RECEIPT_PROFILE,
  permissions: [...RECEIPT_PROFILE.permissions, "incident.create", "incident.read"],
};
const TYPE: Schemas["IncidentType"] = {
  id: receiptId(701),
  current_version_id: receiptId(702),
  revision: 1,
  code: "other",
  label: "Other",
  icon: "alert",
  is_other: true,
  is_active: true,
  severity: "high",
  supervisor: null,
  coordinator: null,
  terminal: receiptId(703),
  supervisor_sla_seconds: 120,
  coordinator_sla_seconds: 120,
  report_evidence_min: 1,
  close_evidence_min: 1,
  blocker_kinds: [],
};
type Journal = Pick<
  Awaited<ReturnType<typeof receiptHarness>>,
  "db" | "attachments" | "bundle" | "engine"
>;
async function harness(t: Parameters<typeof receiptHarness>[0]) {
  const local = await receiptHarness(t);
  await local.db.runAtomically([setStatement("session_profile", JSON.stringify(PROFILE))]);
  let sequence = 710;
  let shiftId: string | null = receiptId(50);
  let lastGps: () => Promise<IncidentGps | null> = () => Promise.resolve(null);
  let photo: EvidencePort["capture"] = () =>
    Promise.resolve({ id: receiptId(sequence++), fileRef: pathToFileURL(local.source).href });
  const remote = {
    readTypes: () => Promise.resolve([TYPE]),
    readReported: (): Promise<Schemas["ReportedIncident"][]> => Promise.resolve([]),
    readSupportContact: () => Promise.resolve("+52 555 000 0000"),
  } satisfies IncidentRemote;
  const compose = (journal: Journal) =>
    new IncidentService({
      ...journal,
      store: new IncidentStore(journal.db),
      current: journal.attachments.session.deps.current,
      canCapture: () => true,
      shift: () => Promise.resolve({ id: shiftId, guard: { sql: "SELECT 1" } }),
      photo: { capture: (context) => photo(context) },
      lastGps: () => lastGps(),
      remote,
      dialer: { open: () => Promise.resolve() },
      uuid: () => receiptId(sequence++),
      now: () => NOW,
    });
  return {
    ...local,
    service: compose(local),
    compose,
    remote,
    setShiftId: (id: string | null) => {
      shiftId = id;
    },
    setGps: (next: () => Promise<IncidentGps | null>) => {
      lastGps = next;
    },
    setPhoto: (next: EvidencePort["capture"]) => {
      photo = next;
    },
  };
}
async function report(h: Awaited<ReturnType<typeof harness>>) {
  await h.service.refresh();
  await h.service.begin("report");
  const id = (await h.service.read()).draft?.eventId;
  assert.ok(id);
  await h.service.edit("type", TYPE.current_version_id, id);
  return id;
}

void test("M12 report saves offline atomically, retries the original UUID after restart and never upgrades an unconfirmed receipt", async (t) => {
  const h = await harness(t),
    id = await report(h);
  await assert.rejects(h.service.save(id), IncidentError);
  await h.service.edit("description", "  Original Other observation  ", id);
  h.failSave();
  await assert.rejects(h.service.save(id), OutboxWriteError);
  assert.equal((await h.service.read()).event, null);
  assert.equal((await h.service.read()).draft?.description, "  Original Other observation  ");
  await h.service.save(id);
  assert.equal((await h.service.read()).event?.status, "pending");
  assert.equal((await h.service.read()).evidencePending, true);
  const restarted = await h.reopen(),
    service = h.compose(restarted),
    sent: string[] = [];
  assert.equal((await service.read()).draft?.eventId, id);
  let shouldLoseReply = true;
  const client = createApiClient({
    baseUrl: "https://incident.example.invalid",
    auth: { kind: "bearer", getAccessToken: () => undefined },
    fetch: async (input) => {
      const batch = (await input.json()) as SyncBatchRequest;
      const event = batch.events[0];
      if (event) {
        sent.push(event.id);
        assert.equal(event.payload.type_id, TYPE.current_version_id);
      }
      if (shouldLoseReply) {
        shouldLoseReply = false;
        throw new Error("Lost reply");
      }
      const reply = answer(
        event ? [{ id, status: "in_review", code: "incident_evidence_required", params: {} }] : [],
      );
      assert.ok(reply.ok);
      return new Response(JSON.stringify(reply.response), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  const deps = {
    outbox: restarted.outbox,
    kv: restarted.kv,
    attachments: attachmentSyncHooks(restarted.attachments),
    deviceId: PROJECTION_IDENTITY.owner.deviceId,
    now: () => NOW,
    transport: createSyncTransport(client),
  };
  assert.equal((await runSyncPass(deps, { batchSize: 50 })).kind, "retry");
  assert.equal((await service.read()).event?.status, "pending");
  await runSyncPass(deps, { batchSize: 50 });
  assert.deepEqual(sent, [id, id]);
  assert.equal((await service.read()).event?.status, "in_review");
  assert.equal((await service.read()).draft?.description, "  Original Other observation  ");
});

void test("M12 accident capture survives restart without details, GPS or files and retains its owner before Save", async (t) => {
  const h = await harness(t);
  await h.service.begin("accident");
  const before = await h.service.read();
  assert.ok(before.draft);
  assert.equal(await hasLocalRecords(h.db), true);
  const other = {
    owner: { ...PROJECTION_IDENTITY.owner, userId: receiptId(799) },
    sessionId: "other-session",
  };
  await assert.rejects(h.attachments.store.bindSession(other));
  const restarted = await h.reopen(),
    service = h.compose(restarted);
  await service.read();
  await service.begin("accident");
  assert.equal((await service.read()).draft?.eventId, before.draft.eventId);
  await service.save(before.draft.eventId);
  const captured = await service.read();
  assert.equal(captured.event?.status, "pending");
  assert.equal(captured.event.envelope.gps, null);
  assert.equal(captured.event.envelope.payload.description, "emergency.accident");
  await assert.rejects(
    service.edit("description", "Late mutation", before.draft.eventId),
    IncidentError,
  );
});

void test("M12 photo failure and Undo retain original fields and bytes; only saved references enroll in the existing journal", async (t) => {
  const h = await harness(t),
    id = await report(h);
  await h.service.edit("description", "Retained observation", id);
  await h.service.photo(id);
  const photo = (await h.service.read()).draft?.evidence[0];
  assert.ok(photo);
  h.setPhoto(() => Promise.reject(new Error("Permission denied")));
  await assert.rejects(h.service.photo(id));
  assert.equal((await h.service.read()).draft?.evidence[0]?.id, photo.id);
  await h.service.undoPhoto(id);
  assert.deepEqual((await h.service.read()).draft?.evidence, []);
  assert.equal(
    (await h.db.query("SELECT 1 FROM attachment_file WHERE id=?", [photo.id])).length,
    1,
  );
  h.setPhoto(() => Promise.resolve({ id: receiptId(798), fileRef: pathToFileURL(h.source).href }));
  await h.service.photo(id);
  await h.service.save(id);
  const bindings = await h.db.query("SELECT evidence_id FROM attachment_event WHERE event_id=?", [
    id,
  ]);
  assert.deepEqual(
    bindings.map((row) => row.evidence_id),
    [receiptId(798)],
  );
  const selection = await h.attachments.session.selection();
  assert.deepEqual(await h.outbox.claimPending(50, selection), []);
  assert.equal((await h.service.read()).event?.status, "pending");
  assert.equal((await h.service.read()).draft?.description, "Retained observation");
});

void test("M12 original scope and raw draft arbitrate a late native photo and REST cache after revocation", async (t) => {
  const h = await harness(t),
    id = await report(h),
    opened = deferred<undefined>(),
    release = deferred<undefined>();
  await h.service.edit("description", "Protected draft", id);
  h.setPhoto(async () => {
    opened.resolve(undefined);
    await release.promise;
    return { id: receiptId(797), fileRef: pathToFileURL(h.source).href };
  });
  const taking = h.service.photo(id);
  await opened.promise;
  await h.db.runAtomically([
    setStatement(
      "session_profile",
      JSON.stringify({ ...PROFILE, permissions: ["field_event.sync"] }),
    ),
  ]);
  release.resolve(undefined);
  await assert.rejects(taking);
  assert.equal((await h.service.read()).draft?.description, "Protected draft");
  assert.deepEqual((await h.service.read()).draft?.evidence, []);
  assert.deepEqual((await h.service.read()).incidents, []);
  await assert.rejects(h.service.save(id), IncidentError);
  await h.db.runAtomically([setStatement("session_profile", JSON.stringify(PROFILE))]);
  const started = deferred<undefined>(),
    reply = deferred<Schemas["IncidentType"][]>();
  h.remote.readTypes = () => {
    started.resolve(undefined);
    return reply.promise;
  };
  const refreshing = h.service.refresh();
  await started.promise;
  await h.db.runAtomically([
    setStatement(
      "session_profile",
      JSON.stringify({ ...PROFILE, permissions: ["field_event.sync"] }),
    ),
  ]);
  reply.resolve([TYPE]);
  await assert.rejects(refreshing);
  assert.deepEqual((await h.service.read()).types, []);
});

void test("M12 incident JSON waits for its matching opening receipt across a future retry without blocking unrelated pulls", async (t) => {
  const h = await harness(t),
    opening = makeEnvelope({ type: "shift.open", shift_id: receiptId(50) });
  await h.outbox.enqueue(opening);
  await h.outbox.claimPending(1);
  await h.outbox.settle([
    { id: opening.id, action: "failTransient", retryAt: "2026-11-07T15:00:00Z" },
  ]);
  await h.service.begin("accident");
  const id = (await h.service.read()).draft?.eventId;
  assert.ok(id);
  await h.service.save(id);
  const selection = await h.attachments.session.selection();
  assert.deepEqual(await h.outbox.claimPending(50, selection), []);
  const pulls: SyncBatchRequest[] = [];
  await runSyncPass(
    {
      outbox: h.outbox,
      kv: h.kv,
      attachments: attachmentSyncHooks(h.attachments),
      deviceId: PROJECTION_IDENTITY.owner.deviceId,
      now: () => NOW,
      transport: (request) => {
        pulls.push(request);
        return Promise.resolve(answer([]));
      },
    },
    { batchSize: 50 },
  );
  assert.ok(pulls.length);
  assert.ok(pulls.every((request) => request.events.length === 0));
});

void test("M12 no operational shift is wire null for an accident and cannot authorize a report", async (t) => {
  const h = await harness(t);
  const shift = await readIncidentShift({
    readWithGuard: () =>
      Promise.resolve({
        guard: { sql: "SELECT 1" },
        snapshot: {
          draft: null,
          opening: null,
          catalog: null,
          map: null,
          gate: null,
          canDepart: false,
          hasOdometerWarning: false,
          lastOdometer: null,
        },
      }),
  });
  assert.equal(shift.id, null);
  h.setShiftId(shift.id);
  await assert.rejects(h.service.begin("report"), IncidentError);
  await h.service.begin("accident");
  const id = (await h.service.read()).draft?.eventId;
  assert.ok(id);
  await h.service.save(id);
  assert.equal((await h.service.read()).event?.envelope.shift_id, null);
});

void test("M12 an unresolved optional GPS preload never blocks Save or mutates a saved emergency later", async (t) => {
  const h = await harness(t),
    started = deferred<undefined>(),
    location = deferred<IncidentGps | null>();
  h.setGps(() => {
    started.resolve(undefined);
    return location.promise;
  });
  const preparing = h.service.prepareGps();
  await started.promise;
  await h.service.begin("accident");
  const id = (await h.service.read()).draft?.eventId;
  assert.ok(id);
  await h.service.save(id);
  assert.equal((await h.service.read()).event?.envelope.gps, null);
  location.resolve({ fix: { lat: 19, lng: -99, accuracy_m: 10 }, fixedAt: NOW.getTime() });
  await preparing;
  assert.equal((await h.service.read()).event?.envelope.gps, null);
});

void test("M12 pulls actual supervisor comments only for genuine own authors or captured source IDs and restores the matching private cache", async (t) => {
  const h = await harness(t),
    id = await report(h),
    foreign = reportedIncident();
  const byAuthor = { ...reportedIncident(), created_by: PROJECTION_IDENTITY.owner.userId };
  const bySource = { ...reportedIncident(), created_by: null, source_event: id };
  h.remote.readReported = () => Promise.resolve([foreign, byAuthor, bySource]);
  await h.service.refresh();
  assert.deepEqual(
    (await h.service.read()).incidents.map((row) => row.id),
    [byAuthor.id, bySource.id],
  );
  const reopened = await h.reopen(),
    service = h.compose(reopened);
  const restored = await service.read();
  assert.equal(restored.incidents[1]?.timeline[0]?.text, bySource.timeline[0]?.text);
  assert.equal(restored.incidents[1]?.publication_state, "outboxed");
  await reopened.db.runAtomically([
    setStatement(
      "session_profile",
      JSON.stringify({ ...PROFILE, permissions: ["field_event.sync"] }),
    ),
  ]);
  assert.deepEqual((await service.read()).incidents, []);
});
