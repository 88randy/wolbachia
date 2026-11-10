import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { setStatement } from "../src/db/kv-store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { DayStore } from "../src/features/day/store.ts";
import { createScanner } from "../src/features/scanner/create-scanner.ts";
import { ScannerSession } from "../src/features/scanner/scanner-session.ts";
import { harness, prepareCheck, engineFor } from "./support/m-08-harness.ts";
import { ASSIGNMENT, CATALOG, RULES } from "./support/m-08-fixtures.ts";
import { fixtureBundle } from "./support/lifecycle-capture-fixture.ts";
import { PROJECTION_IDENTITY, PROJECTION_NOW } from "./support/lifecycle-projection-fixtures.ts";
import { scriptedTransport, answer, accepted } from "./support/scripted-transport.ts";

async function scannerHarness(overrides: Parameters<typeof harness>[1] = {}) {
  const local = await harness(undefined, overrides);
  await new AttachmentStore(local.db).bindSession(PROJECTION_IDENTITY);
  await local.db.runAtomically([
    setStatement(
      "session_profile",
      JSON.stringify({
        issuer: PROJECTION_IDENTITY.owner.issuer,
        sessionId: PROJECTION_IDENTITY.sessionId,
        userId: PROJECTION_IDENTITY.owner.userId,
        organization: {
          id: PROJECTION_IDENTITY.owner.organizationId,
          timezone: "America/Mexico_City",
          epi_week: "iso",
        },
        permissions: [],
      }),
    ),
  ]);
  const body = fixtureBundle(ASSIGNMENT);
  const bundle = new DayBundleService({
    store: new DayStore(local.db),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body }),
  });
  await bundle.refresh();
  return { ...local, body, bundle, scanner: createScanner(local.db, bundle, local.service) };
}

void test("M07 manual routing commits once before navigation and cold services retry the original UUID", async () => {
  const local = await scannerHarness();
  const session = new ScannerSession();
  const open = () =>
    local.scanner.open({
      input: { value: "OV-1", isManual: true },
      eventId: null,
      isCurrent: () => true,
    });
  assert.deepEqual(await session.run("OV-1", open), { route: { name: "ovitrapCapture" } });
  assert.equal(await session.run("OV-1", open), "duplicate");
  const draft = (await local.store.read()).draft;
  assert.ok(draft);
  assert.equal(draft.manualCapture, true);
  assert.equal(draft.ovitrapId, ASSIGNMENT.ovitraps[0]?.id);
  assert.deepEqual(
    await local.db.query("SELECT id FROM outbox_event"),
    [],
    "routing itself submits no event",
  );
  const restarted = await harness(local);
  assert.equal((await restarted.store.read()).draft?.eventId, draft.eventId);
  await prepareCheck(restarted.service);
  await restarted.service.save(draft.eventId);
  const saved = await restarted.store.read();
  assert.equal(saved.event?.status, "pending");
  const transport = scriptedTransport([answer([accepted(draft.eventId)])]);
  await engineFor(restarted, transport.transport, true).start();
  assert.deepEqual(
    transport.requests.flatMap((request) => request.events.map(({ id }) => id)),
    [draft.eventId],
  );
  assert.equal((await restarted.store.read()).event?.status, "sent");
});

void test("M07 manual code rebinding while GPS waits cannot navigate to a draft for the previous physical identity", async () => {
  let releaseGps: () => void = () => {
    throw new Error("GPS resolver unavailable");
  };
  let notifyStarted: () => void = () => {
    throw new Error("GPS start resolver unavailable");
  };
  const gps = new Promise<null>((resolve) => {
    releaseGps = () => {
      resolve(null);
    };
  });
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve;
  });
  const local = await scannerHarness({
    gps: {
      locate: () => {
        notifyStarted();
        return gps;
      },
    },
  });
  const pending = local.scanner.open({
    input: { value: "OV-1", isManual: true },
    eventId: null,
    isCurrent: () => true,
  });
  await started;
  const [physical] = local.body.ovitraps;
  assert.ok(physical);
  const replacement = "99999999-9999-4999-8999-999999999999";
  local.body.ovitraps = [{ ...physical, id: replacement, client_uuid: replacement }];
  await local.bundle.refresh(true);
  releaseGps();
  assert.deepEqual(await pending, { error: "unavailable" });
  assert.equal(
    (await local.store.read()).draft?.ovitrapId,
    physical.id,
    "original draft remains recoverable",
  );
});

void test("M07 callbacks retain the clicked draft UUID when a newer capture exists", async () => {
  const local = await scannerHarness();
  const input = { value: "OV-1", isManual: true };
  await local.scanner.open({ input, eventId: null, isCurrent: () => true });
  const first = (await local.store.read()).draft;
  assert.ok(first);
  await prepareCheck(local.service);
  await local.service.save(first.eventId);
  await local.service.startCheck(`wbf:1:ovitrap:${first.ovitrapId}`, false, first.eventId);
  const replacement = (await local.store.read()).draft;
  assert.ok(replacement);
  assert.notEqual(replacement.eventId, first.eventId);
  const bag = ASSIGNMENT.bags[0];
  assert.ok(bag);
  await assert.rejects(
    local.scanner.open({
      input: { value: bag.code, isManual: true },
      eventId: first.eventId,
      isCurrent: () => true,
    }),
  );
  assert.deepEqual((await local.store.read()).draft, replacement);
});

void test("M07 failed durable writes and cancelled continuations cannot return a destination", async () => {
  const local = await scannerHarness();
  const input = { value: "OV-1", isManual: true };
  assert.deepEqual(await local.scanner.open({ input, eventId: null, isCurrent: () => false }), {
    error: "unavailable",
  });
  local.store.begin = () => Promise.reject(new Error("storage full"));
  await assert.rejects(
    local.scanner.open({ input, eventId: null, isCurrent: () => true }),
    /storage full/,
  );
  assert.equal((await local.store.read()).draft, null);
  assert.deepEqual(await local.db.query("SELECT id FROM outbox_event"), []);
});

void test("M07 a scanned assigned bag keeps automatic provenance and explicit human entry marks manual capture", async () => {
  const local = await scannerHarness();
  const trap = ASSIGNMENT.ovitraps[0];
  const bag = ASSIGNMENT.bags[0];
  assert.ok(trap && bag);
  await local.scanner.open({
    input: { value: `wbf:1:ovitrap:${trap.id}`, isManual: false },
    eventId: null,
    isCurrent: () => true,
  });
  const eventId = (await local.store.read()).draft?.eventId;
  assert.ok(eventId);
  const input = { value: `wbf:1:bag:${bag.id}`, isManual: false, expected: "bag" as const };
  const currentBag = { ...bag, code: "B-CURRENT" };
  await local.store.publishSnapshots(
    { assignment: { ...ASSIGNMENT, bags: [currentBag] }, catalog: CATALOG, rules: RULES },
    await local.store.assignmentAuthority(),
  );
  await local.bundle.refresh(true);
  local.service.draftBuffer.edit(eventId, { temperature: "37" });
  assert.deepEqual(await local.scanner.open({ input, eventId, isCurrent: () => true }), {
    route: { name: "ovitrapCapture" },
  });
  assert.equal((await local.store.read()).draft?.bagCode, currentBag.code);
  assert.equal(
    (await local.store.read()).draft?.assignment?.bags[0]?.code,
    bag.code,
    "original capture assignment is retained",
  );
  assert.equal((await local.store.read()).draft?.temperature, "37");
  assert.equal((await local.store.read()).draft?.manualCapture, false);
  await local.scanner.open({
    input: { value: currentBag.code, isManual: true },
    eventId,
    isCurrent: () => true,
  });
  assert.equal((await local.store.read()).draft?.manualCapture, true);
  assert.deepEqual(await local.db.query("SELECT id FROM outbox_event"), []);
});
