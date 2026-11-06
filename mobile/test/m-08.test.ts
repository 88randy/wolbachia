import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkPayload,
  parseQr,
  normalizePaddle,
  canReuse,
  measureCheckTaps,
  validReason,
} from "../src/features/ovitrap-check/domain.ts";
import { makeDraft } from "./support/m-08-fixtures.ts";
import { captureEvent, voidEvent } from "../src/features/ovitrap-check/events.ts";

void test("AC1: conditional Yes/No never generates numeric egg fields", () => {
  for (const hasEggs of [true, false]) {
    const payload = checkPayload(
      makeDraft({
        paddlePresent: true,
        hasEggs,
        paddleType: "standard",
        bagCode: "B-1",
        evidence: [{ id: "66666666-6666-4666-8666-666666666666", fileRef: "owned-photo" }],
        sourceEvidence: [
          { id: "77777777-7777-4777-8777-777777777777", fileRef: "historical-photo" },
        ],
      }),
    );
    assert.equal(payload.has_eggs, hasEggs);
    assert.equal(payload.bag_code, "B-1");
    assert.deepEqual(payload.evidence_ids, ["66666666-6666-4666-8666-666666666666"]);
    for (const key of ["egg_count", "eggs", "count"])
      assert.equal(Object.hasOwn(payload, key), false);
    assert.deepEqual(
      Object.keys(payload).sort(),
      [
        "ovitrap_id",
        "finding",
        "paddle_present",
        "has_eggs",
        "temperature_c",
        "humidity_pct",
        "paddle_type",
        "is_lagged",
        "bag_code",
        "evidence_ids",
      ].sort(),
    );
  }
  for (const finding of ["closed-house", "absent", "missing", "destroyed"]) {
    const payload = checkPayload(
      normalizePaddle(
        makeDraft({
          finding,
          paddlePresent: true,
          hasEggs: true,
          paddleType: "standard",
          bagCode: "B-1",
        }),
      ),
    );
    assert.deepEqual(
      [payload.paddle_present, payload.has_eggs, payload.paddle_type, payload.bag_code],
      [false, null, null, null],
    );
  }
  assert.equal(
    checkPayload(normalizePaddle(makeDraft({ paddlePresent: false, hasEggs: true }))).has_eggs,
    null,
  );
});

void test("AC1/P21: failed scans never become manual codes", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(parseQr(`wbf:1:bag:${id}`, "bag"), { kind: "bag", id });
  for (const code of [
    `wbf:2:bag:${id}`,
    `wbf:1:lot:${id}`,
    `wbf:1:bag:${id.replaceAll("-", "")}`,
    ` wbf:1:bag:${id}`,
    `wbf:1:bag:${id}\n`,
    `WBF:1:bag:${id}`,
    id,
  ])
    assert.equal(parseQr(code, "bag"), null);
});

void test("AC2: reuse bounds, visible correction reasons and route tap measurement", () => {
  assert.equal(canReuse({ id: "paddle", reuses: 1, isEligible: true }, 2), true);
  assert.equal(canReuse({ id: "paddle", reuses: 2, isEligible: true }, 2), false);
  assert.equal(canReuse(undefined, 2), false);
  assert.equal(canReuse({ id: "paddle", reuses: 2, isEligible: true }, 3), false);
  assert.equal(validReason("\u200b".repeat(20)), false);
  assert.equal(validReason("A visible correction reason"), true);
  assert.equal(validReason("x".repeat(1001)), false);
  assert.equal(validReason("\u2800".repeat(20)), false);
  assert.equal(measureCheckTaps("closed-house"), 2);
  assert.equal(measureCheckTaps("normal"), 10);
});

import { harness, prepareCheck, currentEventId } from "./support/m-08-harness.ts";
import { POINT, RULES } from "./support/m-08-fixtures.ts";
import { saveGate } from "../src/features/ovitrap-check/validation.ts";

void test("AC1: Other, missing configuration, GPS policy and invalid conditions gate the real save", () => {
  const now = new Date("2026-11-05T15:00:00Z");
  const ready = makeDraft({ paddlePresent: false, prepared: ["clean", "water", "liner"] });
  assert.equal(saveGate(ready, now), null);
  assert.equal(saveGate({ ...ready, finding: "other" }, now), "other");
  assert.equal(
    saveGate({ ...ready, finding: "other", otherText: "Covered by a board" }, now),
    null,
  );
  assert.equal(saveGate({ ...ready, humidity: "101" }, now), "conditions");
  assert.equal(saveGate({ ...ready, gps: null }, now), "review");
  assert.equal(saveGate({ ...ready, gps: null, reviewAcknowledged: true }, now), null);
  assert.equal(
    saveGate(
      { ...ready, gps: null, reviewAcknowledged: true, rules: { ...RULES, gpsPolicy: "block" } },
      now,
    ),
    "review",
  );
  assert.equal(saveGate({ ...ready, rules: null, reviewAcknowledged: true }, now), "rules");
  assert.equal(saveGate({ ...ready, catalog: null }, now), "catalog");
  assert.equal(
    saveGate({ ...ready, assignment: { ...ASSIGNMENT, points: [] } }, now),
    "assignment",
  );
  const expired = { ...RULES, nextChangeAt: "2025-01-01T00:00:00Z" };
  assert.equal(saveGate({ ...ready, rules: expired }, now), "review");
  assert.equal(saveGate({ ...ready, rules: expired, reviewAcknowledged: true }, now), null);
  assert.equal(
    saveGate(
      { ...ready, rules: { ...expired, stalePolicy: "block" }, reviewAcknowledged: true },
      now,
    ),
    "rules",
  );
  assert.equal(saveGate({ ...ready, finding: "other", otherText: "\u200b" }, now), "other");
});

void test("AC2: placement, lagged bag and repeat correction retain fixed point and source evidence atomically", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  await h.service.update(
    {
      point: POINT,
      prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
    },
    await currentEventId(h.store),
  );
  await h.service.captureEvidence(await currentEventId(h.store));
  const placed = await h.service.save(await currentEventId(h.store));
  assert.equal(placed.event?.envelope.type, "ovitrap.place");
  assert.ok(placed.draft);
  assert.ok(placed.event);
  const id = placed.draft.ovitrapId;
  await h.service.startCheck(id, true, await currentEventId(h.store));
  await prepareCheck(h.service);
  assert.equal(await h.service.scan("bag", await currentEventId(h.store)), "read");
  await h.service.update({ isLagged: true }, await currentEventId(h.store));
  const original = await h.service.save(await currentEventId(h.store));
  assert.ok(original.event);
  assert.ok(original.draft);
  assert.equal(original.event.envelope.payload.is_lagged, true);
  assert.equal(original.event.envelope.payload.bag_code, "B-QR");
  assert.equal(original.draft.bagUuid, "33333333-3333-4333-8333-333333333333");
  assert.equal(original.draft.point?.id, POINT.id);
  const repeat = await h.service.startCheck(id, true, await currentEventId(h.store));
  assert.equal(repeat.repeat?.envelope.id, original.event.envelope.id);
  await h.service.correct(await currentEventId(h.store));
  await h.service.update(
    {
      reasonCode: "other",
      reason: "Correcting the visit result",
      bagCode: "B-NEW",
      prepared: ["clean", "water", "liner"],
    },
    await currentEventId(h.store),
  );
  const replacement = await h.service.save(await currentEventId(h.store));
  const rows = await h.db.query("SELECT type, voids_event_id FROM outbox_event ORDER BY seq");
  assert.deepEqual(
    rows.map((row) => row.type),
    ["ovitrap.place", "ovitrap.check", "record.void", "ovitrap.check"],
  );
  assert.equal(rows[2]?.voids_event_id, original.event.envelope.id);
  assert.ok(replacement.draft);
  assert.ok(replacement.event);
  assert.notEqual(replacement.event.envelope.id, original.event.envelope.id);
  assert.equal(replacement.draft.sourceEvidence[0]?.id, placed.draft.evidence[0]?.id);
  assert.equal((await h.db.query("SELECT * FROM ovitrap_capture")).length, 3);
  assert.equal((await h.db.query("SELECT * FROM ovitrap_lineage")).length, 1);
  await h.engine.requestSync();
});

void test("AC3: failed SQLite commit retains draft/evidence and never publishes a saved record", async () => {
  const h = await harness();
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await h.service.update(
    { bagCode: "B-1", reviewAcknowledged: true },
    await currentEventId(h.store),
  );
  await h.db.runAtomically([
    {
      sql: "CREATE TRIGGER simulate_full BEFORE INSERT ON ovitrap_capture BEGIN SELECT RAISE(ABORT, 'disk full'); END",
    },
  ]);
  await assert.rejects(h.service.save(await currentEventId(h.store)));
  assert.equal((await h.service.read()).event, null);
  assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 0);
  assert.equal((await h.service.read()).draft?.bagCode, "B-1");
  await h.db.runAtomically([{ sql: "DROP TRIGGER simulate_full" }]);
  await Promise.all([
    h.service.save(await currentEventId(h.store)),
    h.service.save(await currentEventId(h.store)),
  ]);
  assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 1);
  await h.engine.requestSync();
});

void test("AC2: corrections retain current capture provenance and require a fresh bag", async () => {
  const h = await harness();
  await h.service.startCheck(
    "wbf:1:ovitrap:44444444-4444-4444-8444-444444444444",
    false,
    await currentEventId(h.store),
  );
  await h.service.update(
    {
      finding: "fine",
      paddlePresent: true,
      hasEggs: true,
      paddleType: "standard",
      prepared: ["clean", "water", "liner"],
      reviewAcknowledged: true,
    },
    await currentEventId(h.store),
  );
  await h.service.scan("bag", await currentEventId(h.store));
  const original = await h.service.save(await currentEventId(h.store));
  assert.ok(original.event);
  assert.equal(original.draft?.manualCapture, false);
  const originalId = original.event.envelope.id;
  assert.ok(originalId);
  const changed = await harness(h, {
    gps: { locate: () => Promise.resolve({ lat: 20, lng: -100, accuracy_m: 70 }) },
    shiftId: () => Promise.resolve("66666666-6666-4666-8666-666666666666"),
  });
  await changed.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(changed.store),
  );
  await changed.service.correct(await currentEventId(changed.store));
  const correction = await changed.service.read();
  assert.ok(correction.draft);
  assert.equal(correction.draft.manualCapture, true);
  assert.equal(correction.draft.shiftId, "66666666-6666-4666-8666-666666666666");
  assert.equal(correction.draft.gps?.accuracy_m, 70);
  assert.equal(correction.draft.reviewAcknowledged, false);
  assert.equal(correction.draft.bagCode, "");
  assert.equal(correction.draft.bagUuid, null);
  await changed.service.update(
    {
      reasonCode: "other",
      reason: "A visible correction reason",
      bagCode: "B-QR",
      reviewAcknowledged: true,
      prepared: ["clean", "water", "liner"],
    },
    await currentEventId(changed.store),
  );
  await assert.rejects(changed.service.save(await currentEventId(changed.store)));
  assert.equal((await changed.db.query("SELECT * FROM ovitrap_lineage")).length, 0);
  await changed.engine.requestSync();
  await h.engine.requestSync();
});

void test("AC2: a different target never silently resumes the previous target draft", async () => {
  const h = await harness();
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await assert.rejects(
    h.service.startCheck(
      "99999999-9999-4999-8999-999999999999",
      true,
      await currentEventId(h.store),
    ),
  );
  await assert.rejects(h.service.startPlace(await currentEventId(h.store)));
  assert.equal((await h.service.read()).draft?.ovitrapId, "44444444-4444-4444-8444-444444444444");
});

void test("AC1: placement rejects out-of-assignment points and malformed or oversized UUID references", () => {
  const now = new Date("2026-01-15T12:00:00Z");
  const ready = makeDraft({
    mode: "place",
    prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
  });
  assert.equal(saveGate({ ...ready, point: { ...POINT, id: "foreign-point" } }, now), "point");
  assert.equal(saveGate({ ...ready, supplyRefs: ["LOT-1"] }, now), "point");
  assert.equal(
    saveGate({ ...ready, supplyRefs: Array.from({ length: 101 }, () => POINT.id) }, now),
    "point",
  );
});

void test("AC3: null or omitted GPS accuracy remains readable and syncable after review acknowledgement", async () => {
  for (const gps of [
    { lat: 19, lng: -99, accuracy_m: null },
    { lat: 19, lng: -99 },
  ]) {
    const h = await harness(undefined, { gps: { locate: () => Promise.resolve(gps) } });
    await h.service.startCheck(
      "44444444-4444-4444-8444-444444444444",
      true,
      await currentEventId(h.store),
    );
    await prepareCheck(h.service);
    const saved = await h.service.save(await currentEventId(h.store));
    assert.ok(saved.event);
    await h.engine.requestSync();
    assert.equal((await h.outbox.claimPending(10)).length, 1);
  }
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { KvStore } from "../src/db/kv-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { engineFor } from "./support/m-08-harness.ts";
import { accepted, answer, scriptedTransport } from "./support/scripted-transport.ts";
import { FIXED_NOW } from "./support/factories.ts";
import type { SqlExecutor } from "../src/db/sql.ts";
import { CATALOG, ASSIGNMENT } from "./support/m-08-fixtures.ts";
const storesFor = (db: SqlExecutor) => ({
  db,
  kv: new KvStore(db),
  outbox: new OutboxRepository(db, () => FIXED_NOW),
});

void test("AC3: cold SQLite reopen restores draft and interrupted upload sends the original UUID once", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wolbachia-m08-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  const path = join(directory, "phone.sqlite");
  let phone = await openTestDatabase(path);
  try {
    const first = await harness(storesFor(phone.executor));
    await first.service.startCheck(
      "44444444-4444-4444-8444-444444444444",
      true,
      await currentEventId(first.store),
    );
    await prepareCheck(first.service);
    const draftId = (await first.service.read()).draft?.eventId;
    assert.ok(draftId);
    phone.close();
    phone = await openTestDatabase(path);
    const second = await harness(storesFor(phone.executor));
    assert.equal((await second.service.read()).draft?.eventId, draftId);
    const saved = await second.service.save(await currentEventId(second.store));
    assert.equal(saved.event?.status, "pending");
    await second.engine.requestSync();
    await second.outbox.claimPending(10);
    phone.close();
    phone = await openTestDatabase(path);
    const third = storesFor(phone.executor);
    const transport = scriptedTransport([answer([accepted(draftId)]), answer([])]);
    const engine = engineFor(third, transport.transport, true);
    await engine.retryNow();
    await engine.requestSync();
    assert.deepEqual(
      transport.requests.flatMap((request) => request.events.map((event) => event.id)),
      [draftId],
    );
    const [row] = await third.db.query("SELECT id, local_status FROM outbox_event");
    assert.equal(row?.id, draftId);
    assert.equal(row.local_status, "sent");
  } finally {
    phone.close();
    rmSync(directory, { recursive: true });
  }
});

void test("AC2: correction transaction failure keeps original lineage and evidence intact", async () => {
  const h = await harness();
  const target = "44444444-4444-4444-8444-444444444444";
  await h.service.startCheck(target, true, await currentEventId(h.store));
  await prepareCheck(h.service);
  await h.service.save(await currentEventId(h.store));
  await h.service.startCheck(target, true, await currentEventId(h.store));
  await h.service.correct(await currentEventId(h.store));
  await h.service.update(
    {
      reasonCode: "other",
      reason: "A visible correction reason",
      bagCode: "B-NEW",
      prepared: ["clean", "water", "liner"],
      reviewAcknowledged: true,
    },
    await currentEventId(h.store),
  );
  await h.db.runAtomically([
    {
      sql: "CREATE TRIGGER fail_lineage BEFORE INSERT ON ovitrap_lineage BEGIN SELECT RAISE(ABORT, 'disk full'); END",
    },
  ]);
  await assert.rejects(h.service.save(await currentEventId(h.store)));
  assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 1);
  assert.equal((await h.db.query("SELECT * FROM ovitrap_lineage")).length, 0);
  assert.equal((await h.service.read()).event, null);
  await h.engine.requestSync();
});

void test("AC2: offline use consumes cached reuse eligibility before another capture can offer a third reuse", async () => {
  const h = await harness();
  await h.store.saveSnapshots({
    catalog: CATALOG,
    rules: RULES,
    assignment: { ...ASSIGNMENT, reuse: [{ id: "paddle-1", reuses: 1, isEligible: true }] },
  });
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await h.service.update({ reuseId: "paddle-1" }, await currentEventId(h.store));
  await h.service.save(await currentEventId(h.store));
  await h.store.saveSnapshots({
    catalog: CATALOG,
    rules: RULES,
    assignment: {
      ...ASSIGNMENT,
      version: "assignment-v2",
      reuse: [{ id: "paddle-1", reuses: 1, isEligible: true }],
    },
  });
  await h.service.startCheck(
    "99999999-9999-4999-8999-999999999999",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await h.service.update({ reuseId: "paddle-1", bagCode: "B-NEW" }, await currentEventId(h.store));
  const current = await h.service.read();
  assert.equal(current.reuse[0]?.reuses, 2);
  await assert.rejects(h.service.save(await currentEventId(h.store)));
  await h.engine.requestSync();
});

void test("AC1: an old source photo cannot satisfy current visit evidence and historical Other labels remain pinned", async () => {
  const h = await harness();
  const catalog = {
    ...CATALOG,
    findings: CATALOG.findings.map((item) =>
      item.code === "fine" ? { ...item, requires_photo: true } : item,
    ),
  };
  await h.store.saveSnapshots({ catalog, rules: RULES, assignment: ASSIGNMENT });
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  assert.equal(
    saveGate(
      makeDraft({
        catalog,
        paddlePresent: false,
        prepared: ["clean", "water", "liner"],
        sourceEvidence: [{ id: POINT.id, fileRef: "file:///old.jpg" }],
      }),
      FIXED_NOW,
    ),
    "evidence",
  );
  await assert.rejects(h.service.save(await currentEventId(h.store)));
  await h.service.captureEvidence(await currentEventId(h.store));
  await h.service.update(
    { finding: "other", otherText: "A visible finding" },
    await currentEventId(h.store),
  );
  await h.store.saveSnapshots({
    catalog: { ...CATALOG, version: "catalog-v2", findings: [] },
    rules: RULES,
    assignment: ASSIGNMENT,
  });
  const saved = await h.service.save(await currentEventId(h.store));
  assert.equal(saved.event?.envelope.catalog_version, "catalog-v1");
  assert.equal(saved.event.envelope.payload.other_text, "A visible finding");
  await h.engine.requestSync();
});

void test("AC3: a revoked downloaded assignment blocks capture without losing its draft", async () => {
  const h = await harness();
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await h.store.saveSnapshots({ catalog: CATALOG, rules: RULES, assignment: null });
  assert.equal((await h.service.read()).isScopeBlocked, true);
  await assert.rejects(h.service.save(await currentEventId(h.store)));
  assert.equal((await h.service.read()).draft?.bagCode, "B-TEST");
});

import { correctionDraft } from "../src/features/ovitrap-check/correction.ts";
import { OvitrapDraftBuffer } from "../src/features/ovitrap-check/draft-buffer.ts";
import { runCaptureAction } from "../src/features/ovitrap-check/use-capture-actions.ts";
import type { FieldEventEnvelope } from "../src/outbox/outbox-event.ts";

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// The server sorts each batch independently of outbox insertion order.
function applyCorrection(events: readonly FieldEventEnvelope[], shouldFailReplacement = false) {
  let active: string | null = "11111111-1111-4111-8111-111111111111";
  const results = new Map<string, string>();
  const sorted = [...events].sort(
    (left, right) =>
      Date.parse(left.device_time) - Date.parse(right.device_time) ||
      left.id.localeCompare(right.id),
  );
  for (const event of sorted) {
    if (event.type === "record.void") {
      assert.equal(event.voids_event_id, active);
      active = null;
      results.set(event.id, "accepted");
      continue;
    }
    const code = active ? "reading_exists" : shouldFailReplacement ? "bag_code_used" : "accepted";
    results.set(event.id, code);
    if (code === "accepted") active = event.id;
  }
  return { active, results };
}

void test("regression: correction server order ignores UUID order and preserves a later failure", () => {
  const low = "22222222-2222-4222-8222-222222222222";
  const high = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  for (const [replacementId, voidId] of [
    [low, high],
    [high, low],
  ] as const) {
    const source = makeDraft();
    const draft = correctionDraft(makeDraft({ eventId: replacementId }), source, voidId);
    const replacement = captureEvent(draft);
    const annulment = voidEvent(draft);
    assert.ok(Date.parse(annulment.device_time) > Date.parse(source.deviceTime));
    assert.ok(Date.parse(replacement.device_time) > Date.parse(annulment.device_time));
    assert.equal(replacement.device_time, draft.deviceTime);
    const applied = applyCorrection([replacement, annulment]);
    assert.equal(applied.active, replacementId);
    assert.equal(applied.results.get(replacementId), "accepted");
    const failed = applyCorrection([replacement, annulment], true);
    assert.equal(failed.active, null);
    assert.equal(failed.results.get(voidId), "accepted");
    assert.equal(failed.results.get(replacementId), "bag_code_used");
  }
});

void test("regression: a blocked shift prevents entry and saving an existing draft", async () => {
  let isAuthorized = false;
  const h = await harness(undefined, {
    shiftId: () => Promise.resolve(isAuthorized ? "55555555-5555-4555-8555-555555555555" : ""),
  });
  const target = "44444444-4444-4444-8444-444444444444";
  await assert.rejects(
    h.service.startCheck(target, true, await currentEventId(h.store)),
    /ShiftBlockedError/,
  );
  await assert.rejects(h.service.startPlace(await currentEventId(h.store)), /ShiftBlockedError/);
  assert.equal((await h.service.read()).draft, null);
  isAuthorized = true;
  await h.service.startCheck(target, true, await currentEventId(h.store));
  await prepareCheck(h.service);
  const draft = (await h.service.read()).draft;
  isAuthorized = false;
  await assert.rejects(
    h.service.startCheck(target, true, await currentEventId(h.store)),
    /ShiftBlockedError/,
  );
  await assert.rejects(h.service.save(await currentEventId(h.store)), /ShiftBlockedError/);
  assert.deepEqual((await h.service.read()).draft, draft);
  assert.equal((await h.db.query("SELECT * FROM ovitrap_capture")).length, 0);
  isAuthorized = true;
  assert.ok((await h.service.save(await currentEventId(h.store))).event);
  await h.engine.requestSync();
});

void test("regression: November 5 and 12 under the W45 package are different capture weeks", async () => {
  let now = new Date("2026-11-05T15:00:00Z");
  const h = await harness(undefined, { now: () => now });
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await h.service.save(await currentEventId(h.store));
  now = new Date("2026-11-12T15:00:00Z");
  const second = await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  assert.equal(second.draft?.assignment?.epiWeek, "2026-W45");
  assert.equal(second.repeat, null);
  await prepareCheck(h.service);
  await h.service.update({ bagCode: "B-NEXT-WEEK" }, await currentEventId(h.store));
  await h.service.save(await currentEventId(h.store));
  assert.deepEqual(
    (await h.db.query("SELECT epi_week FROM ovitrap_capture ORDER BY rowid")).map(
      (row) => row.epi_week,
    ),
    ["2026-W45", "2026-W46"],
  );
  assert.ok(
    (
      await h.service.startCheck(
        "44444444-4444-4444-8444-444444444444",
        true,
        await currentEventId(h.store),
      )
    ).repeat,
  );
  await h.engine.requestSync();
});

void test("regression: missing organization week configuration blocks explicitly without guessing W45", async () => {
  const h = await harness();
  await h.store.saveSnapshots({
    catalog: CATALOG,
    rules: RULES,
    assignment: { ...ASSIGNMENT, organization: undefined },
  });
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await assert.rejects(h.service.save(await currentEventId(h.store)), /weekContext/);
  assert.equal((await h.service.read()).draft?.bagCode, "B-TEST");
  assert.equal((await h.db.query("SELECT * FROM ovitrap_capture")).length, 0);
});

void test("regression: an immutable late edit is reported and does not block the next capture command", async () => {
  const entered = barrier();
  const release = barrier();
  const h = await harness();
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  const enqueue = h.engine.enqueue.bind(h.engine);
  h.engine.enqueue = async (...args) => {
    entered.resolve();
    await release.promise;
    await enqueue(...args);
  };
  const saving = h.service.save(await currentEventId(h.store));
  await entered.promise;
  const buffer = h.service.draftBuffer;
  const editingDraft = (await h.service.read()).draft;
  assert.ok(editingDraft);
  buffer.edit(editingDraft.eventId, {
    otherText: "Late finding text",
    reason: "Late correction reason",
  });
  let notice: string | null = null;
  const commands = {
    service: h.service,
    buffer,
    refresh: async () => {
      await h.service.read();
    },
    setError: (key: string | null) => {
      notice = key;
    },
  };
  const editing = runCaptureAction(
    commands,
    async () => h.service.startPlace(await currentEventId(h.store)),
    { eventId: await currentEventId(commands.service) },
  );
  release.resolve();
  const saved = await saving;
  assert.equal(await editing, false);
  assert.equal(notice, "mobile.ovitrap.immutableEdit");
  assert.equal((await h.service.read()).draft?.otherText, "");
  assert.equal(
    await runCaptureAction(
      commands,
      async () => h.service.startPlace(await currentEventId(h.store)),
      { eventId: await currentEventId(commands.service) },
    ),
    true,
  );
  const next = await h.service.read();
  assert.notEqual(next.draft?.eventId, saved.draft?.eventId);
  assert.equal(buffer.merge(next).draft?.otherText, "");
  assert.equal(buffer.merge(next).draft?.reason, "");
  await h.engine.requestSync();
});

import { captureWeek } from "../src/features/ovitrap-check/capture-week.ts";
import { captureShiftId } from "../src/features/ovitrap-check/shift-authorization.ts";
import { ShiftOpenService } from "../src/features/shift-open/service.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { UNAVAILABLE_MAP } from "../src/features/shift-open/domain.ts";
import { actionErrorKey } from "../src/features/ovitrap-check/action-error-key.ts";
import { ImmutableCaptureError } from "../src/features/ovitrap-check/draft-buffer.ts";

async function authorizedShift(h: Awaited<ReturnType<typeof harness>>) {
  const store = new ShiftOpenStore(h.db);
  const item = CATALOG.findings[0];
  assert.ok(item);
  await store.saveCatalog({ version: "motorcycle-v1", items: [item] });
  await store.saveMap({
    ...UNAVAILABLE_MAP,
    status: "ready",
    version: "maps-v1",
    coverage: ["Q-1"],
    requiredCoverage: ["Q-1"],
    assets: [{ id: "Q-1.pmtiles", license: "licensed", size: 10 }],
    verifiedAssets: [
      { id: "Q-1.pmtiles", fileRef: "file:///Q-1.pmtiles", size: 10, sha256: "test-hash" },
    ],
    progress: 100,
  });
  let sequence = 0;
  const shift = new ShiftOpenService({
    store,
    engine: h.engine,
    now: () => FIXED_NOW,
    uuid: () => `77777777-7777-4777-8777-${String(++sequence).padStart(12, "0")}`,
    maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
    photos: { capture: () => Promise.resolve({ status: "unavailable" }) },
  });
  await shift.start();
  await shift.update({ motorcycle_code: "M-TEST" });
  await shift.update({ odometer_km: "100", checks: [{ item: item.code, result: "ok" }] });
  const opened = await shift.open();
  assert.equal(opened.canDepart, true);
  assert.ok(opened.opening);
  return { shift, opened };
}

void test("regression: real departure authorization blocks severe_check in_review at entry and save", async () => {
  const h = await harness();
  const { shift, opened } = await authorizedShift(h);
  assert.ok(opened.opening);
  const capture = await harness(h, { shiftId: async () => captureShiftId(await shift.read()) });
  const target = "44444444-4444-4444-8444-444444444444";
  await capture.service.startCheck(target, true, await currentEventId(capture.store));
  await prepareCheck(capture.service);
  const draft = (await capture.service.read()).draft;
  await h.outbox.claimPending(10);
  await h.outbox.settle([
    {
      id: opened.opening.envelope.id,
      action: "review",
      result: { code: "severe_check", params: {} },
    },
  ]);
  const blocked = await shift.read();
  assert.equal(blocked.canDepart, false);
  assert.equal(blocked.gate, "severe");
  assert.equal(captureShiftId(blocked), ""); // Same decision used by P3 and the production factory.
  assert.equal((await capture.service.read()).isShiftBlocked, true);
  await assert.rejects(
    capture.service.startCheck(target, true, await currentEventId(capture.store)),
    /ShiftBlockedError/,
  );
  await assert.rejects(
    capture.service.startPlace(await currentEventId(capture.store)),
    /ShiftBlockedError/,
  );
  await assert.rejects(
    capture.service.save(await currentEventId(capture.store)),
    /ShiftBlockedError/,
  );
  assert.deepEqual((await capture.service.read()).draft, draft);
  assert.equal((await h.db.query("SELECT * FROM ovitrap_capture")).length, 0);
  await capture.engine.requestSync();
  await h.engine.requestSync();
});

void test("regression: capture week matches organization-local ISO/MMWR year and Sunday boundaries", () => {
  for (const [deviceTime, system, expected] of [
    ["2026-01-04T18:00:00Z", "iso", "2026-W01"],
    ["2026-01-04T18:00:00Z", "mmwr", "2026-W01"],
    ["2026-01-03T18:00:00Z", "mmwr", "2025-W53"],
    ["2021-01-01T18:00:00Z", "iso", "2020-W53"],
    ["2025-12-29T18:00:00Z", "iso", "2026-W01"],
    ["2026-11-08T18:00:00Z", "iso", "2026-W45"],
    ["2026-11-08T18:00:00Z", "mmwr", "2026-W45"],
    ["2026-11-09T02:00:00Z", "iso", "2026-W45"],
    ["2026-11-09T06:00:00Z", "iso", "2026-W46"],
  ] as const) {
    const draft = makeDraft({
      deviceTime,
      assignment: {
        ...ASSIGNMENT,
        organization: { timezone: "America/Mexico_City", epi_week: system },
      },
    });
    assert.equal(captureWeek(draft), expected, `${deviceTime} ${system}`);
  }
  assert.equal(
    captureWeek(
      makeDraft({
        assignment: { ...ASSIGNMENT, organization: { timezone: "invalid-zone", epi_week: "iso" } },
      }),
    ),
    null,
  );
});

void test("regression: SQL skipped immutable edits are reported and discarded after another writer commits", async () => {
  const entered = barrier();
  const release = barrier();
  const h = await harness();
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  const update = h.store.update.bind(h.store);
  h.store.update = async (draft) => {
    entered.resolve();
    await release.promise;
    return update(draft);
  };
  const buffer = h.service.draftBuffer;
  const editingDraft = (await h.service.read()).draft;
  assert.ok(editingDraft);
  buffer.edit(editingDraft.eventId, { reason: "Pending correction text" });
  const persisting = assert.rejects(buffer.persist(h.service), ImmutableCaptureError);
  await entered.promise;
  const other = await harness(h);
  await other.service.save(await currentEventId(other.store));
  release.resolve();
  await persisting;
  assert.equal(actionErrorKey(new ImmutableCaptureError()), "mobile.ovitrap.immutableEdit");
  await buffer.persist(h.service);
  await h.engine.requestSync();
  await other.engine.requestSync();
});

void test("regression: an authorized replacement shift supersedes the old draft with evidence across restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wolbachia-m08-shift-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  const path = join(directory, "phone.sqlite");
  let phone = await openTestDatabase(path);
  try {
    const h = await harness(storesFor(phone.executor));
    const { shift, opened } = await authorizedShift(h);
    assert.ok(opened.opening);
    const shiftId = async () => captureShiftId(await shift.read());
    const capture = await harness(h, { shiftId });
    await capture.service.startCheck(
      "44444444-4444-4444-8444-444444444444",
      true,
      await currentEventId(capture.store),
    );
    await prepareCheck(capture.service);
    await capture.service.captureEvidence(await currentEventId(capture.store));
    const original = (await capture.service.read()).draft;
    assert.ok(original);
    await h.outbox.claimPending(10);
    await h.outbox.settle([
      {
        id: opened.opening.envelope.id,
        action: "reject",
        result: { code: "motorcycle_blocked", params: {} },
      },
    ]);
    await assert.rejects(
      capture.service.startPlace(await currentEventId(capture.store)),
      /ShiftBlockedError/,
    );
    await shift.restartRejected();
    const item = CATALOG.findings[0];
    assert.ok(item);
    await shift.update({ motorcycle_code: "M-RETRY" });
    await shift.update({ odometer_km: "100", checks: [{ item: item.code, result: "ok" }] });
    const replacement = await shift.open();
    assert.equal(replacement.canDepart, true);
    const beforeStart = await capture.service.read();
    assert.equal(beforeStart.canStartCapture, true);
    assert.equal(beforeStart.isShiftBlocked, true);
    await assert.rejects(
      capture.service.update(
        { otherText: "Cannot reassign old evidence" },
        await currentEventId(capture.store),
      ),
      /ShiftBlockedError/,
    );
    await assert.rejects(
      capture.service.adoptSnapshots(await currentEventId(capture.store)),
      /ShiftBlockedError/,
    );
    const buffer = capture.service.draftBuffer;
    buffer.edit(original.eventId, { otherText: "Old shift input" });
    let notice: string | null = null;
    const command = {
      service: capture.service,
      buffer,
      refresh: async () => {
        await capture.service.read();
      },
      setError: (key: string | null) => {
        notice = key;
      },
    };
    assert.equal(
      await runCaptureAction(
        command,
        async () => capture.service.startPlace(await currentEventId(capture.store)),
        { eventId: await currentEventId(command.service), startsCapture: true },
      ),
      true,
    );
    assert.equal(notice, "mobile.ovitrap.immutableEdit");
    const fresh = buffer.merge(await capture.service.read());
    assert.ok(fresh.draft);
    assert.ok(replacement.draft);
    assert.equal(fresh.draft.otherText, "");
    assert.equal(fresh.isShiftBlocked, false);
    assert.equal(fresh.draft.shiftId, replacement.draft.clientShiftId);
    assert.notEqual(fresh.draft.eventId, original.eventId);
    assert.deepEqual(fresh.draft.evidence, []);
    const [archived] = await h.db.query(
      "SELECT draft, replacement_event_id FROM ovitrap_superseded_draft WHERE event_id = ?",
      [original.eventId],
    );
    assert.ok(archived);
    assert.deepEqual(JSON.parse(String(archived.draft)), original);
    assert.equal(archived.replacement_event_id, fresh.draft.eventId);
    await capture.engine.requestSync();
    await h.engine.requestSync();
    phone.close();
    phone = await openTestDatabase(path);
    const restoredShift = new ShiftOpenService({
      store: new ShiftOpenStore(phone.executor),
      engine: h.engine,
      now: () => FIXED_NOW,
      uuid: () => assert.fail("Restart must retain the authorized shift"),
      maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
      photos: { capture: () => Promise.resolve({ status: "unavailable" }) },
    });
    const restored = await harness(storesFor(phone.executor), {
      shiftId: async () => captureShiftId(await restoredShift.read()),
    });
    assert.equal((await restored.service.read()).draft?.eventId, fresh.draft.eventId);
    await restored.service.update(
      {
        point: POINT,
        prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
      },
      await currentEventId(restored.store),
    );
    assert.ok((await restored.service.save(await currentEventId(restored.store))).event);
    const [retained] = await restored.db.query("SELECT draft FROM ovitrap_superseded_draft");
    assert.ok(retained);
    assert.deepEqual(JSON.parse(String(retained.draft)), original);
    await restored.engine.requestSync();
  } finally {
    phone.close();
    rmSync(directory, { recursive: true });
  }
});

void test("regression: retry after a post-begin read failure never saves the previous shift's buffered conditions", async () => {
  let shiftId = "55555555-5555-4555-8555-555555555555";
  const h = await harness(undefined, { shiftId: () => Promise.resolve(shiftId) });
  const original = await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  assert.ok(original.draft);
  const buffer = h.service.draftBuffer;
  buffer.edit(original.draft.eventId, { temperature: "37", humidity: "88" });
  shiftId = "66666666-6666-4666-8666-666666666666";
  let shouldFailRead = false;
  const read = h.store.read.bind(h.store);
  h.store.read = () => {
    if (shouldFailRead) {
      shouldFailRead = false;
      return Promise.reject(new Error("Read failed after the new draft committed"));
    }
    return read();
  };
  const begin = h.store.begin.bind(h.store);
  h.store.begin = async (draft) => {
    await begin(draft);
    shouldFailRead = true;
  };
  const notices: string[] = [];
  const commands = {
    service: h.service,
    buffer,
    refresh: async () => {
      await h.service.read();
    },
    setError: (key: string | null) => {
      if (key) notices.push(key);
    },
  };
  const target = "99999999-9999-4999-8999-999999999999";
  assert.equal(
    await runCaptureAction(
      commands,
      async () => h.service.startCheck(target, true, await currentEventId(h.store)),
      { eventId: await currentEventId(commands.service), startsCapture: true },
    ),
    false,
  );
  const replacement = await h.service.read();
  assert.notEqual(replacement.draft?.eventId, original.draft.eventId);
  assert.equal(replacement.draft?.shiftId, shiftId);
  assert.equal(replacement.draft.ovitrapId, target);
  assert.ok(notices.includes("mobile.ovitrap.immutableEdit"));
  assert.equal(
    await runCaptureAction(
      commands,
      async () => h.service.startCheck(target, true, await currentEventId(h.store)),
      { eventId: await currentEventId(commands.service), startsCapture: true },
    ),
    true,
  );
  await prepareCheck(h.service);
  assert.equal(
    await runCaptureAction(commands, async () => h.service.save(await currentEventId(h.store)), {
      eventId: await currentEventId(commands.service),
    }),
    true,
  );
  const saved = await h.service.read();
  assert.equal(saved.event?.envelope.payload.temperature_c, null);
  assert.equal(saved.event.envelope.payload.humidity_pct, null);
  await h.engine.requestSync();
});

void test("regression: neither merge nor persist can apply a buffer to another event UUID", async () => {
  for (const operation of ["merge", "persist"] as const) {
    let shiftId = "55555555-5555-4555-8555-555555555555";
    const h = await harness(undefined, { shiftId: () => Promise.resolve(shiftId) });
    const original = await h.service.startCheck(
      "44444444-4444-4444-8444-444444444444",
      true,
      await currentEventId(h.store),
    );
    assert.ok(original.draft);
    const buffer = new OvitrapDraftBuffer();
    buffer.edit(original.draft.eventId, { temperature: "37", humidity: "88" });
    shiftId = "66666666-6666-4666-8666-666666666666";
    const replacement = await h.service.startCheck(
      "99999999-9999-4999-8999-999999999999",
      true,
      await currentEventId(h.store),
    );
    if (operation === "merge") {
      const displayed = buffer.merge(replacement);
      assert.equal(displayed.draft?.temperature, "");
      assert.equal(displayed.draft.humidity, "");
      assert.equal(buffer.takeDiscardedEditNotice(), true);
    } else {
      await assert.rejects(buffer.persist(h.service), ImmutableCaptureError);
    }
    await buffer.persist(h.service);
    assert.equal((await h.service.read()).draft?.temperature, "");
    assert.equal((await h.service.read()).draft?.humidity, "");
  }
});

void test("regression: a draft replaced while a buffered update reads cannot receive the old patch", async () => {
  let shiftId = "55555555-5555-4555-8555-555555555555";
  const h = await harness(undefined, { shiftId: () => Promise.resolve(shiftId) });
  const original = await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  assert.ok(original.draft);
  const buffer = h.service.draftBuffer;
  buffer.edit(original.draft.eventId, { temperature: "37", humidity: "88" });
  const entered = barrier();
  const release = barrier();
  const read = h.service.read.bind(h.service);
  h.service.read = async () => {
    entered.resolve();
    await release.promise;
    return read();
  };
  const persisting = assert.rejects(buffer.persist(h.service), ImmutableCaptureError);
  await entered.promise;
  shiftId = "66666666-6666-4666-8666-666666666666";
  const other = await harness(h, { shiftId: () => Promise.resolve(shiftId) });
  await other.service.startCheck(
    "99999999-9999-4999-8999-999999999999",
    true,
    await currentEventId(other.store),
  );
  release.resolve();
  await persisting;
  const replacement = await h.service.read();
  assert.equal(replacement.draft?.temperature, "");
  assert.equal(replacement.draft.humidity, "");
  await buffer.persist(h.service);
});

import { observeCaptureUpdates } from "../src/features/ovitrap-check/observe-capture-updates.ts";
import { editConfirmation } from "../src/features/ovitrap-check/confirmation-command.ts";

void test("round 4: every capture command rejects another displayed UUID before any effect", async () => {
  const portEffect = () => assert.fail("A stale command must not open a native port");
  const h = await harness();
  const current = await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  assert.ok(current.draft);
  const guarded = await harness(h, {
    gps: { locate: portEffect },
    scanner: { scan: portEffect },
    evidence: { capture: portEffect },
  });
  const service = guarded.service;
  const staleId = "99999999-9999-4999-8999-999999999999";
  const commands = {
    refresh: () => service.refresh(staleId),
    update: () => service.update({ step: "confirm" }, staleId),
    save: () => service.save(staleId),
    correct: () => service.correct(staleId),
    enterBag: () => service.enterBag("B-STALE", staleId),
    scanBag: () => service.scan("bag", staleId),
    scanOvitrap: () => service.scan("ovitrap", staleId),
    captureEvidence: () => service.captureEvidence(staleId),
    refreshGps: () => service.refreshGps(staleId),
    adoptSnapshots: () => service.adoptSnapshots(staleId),
    startPlace: () => service.startPlace(staleId),
    startCheck: () => service.startCheck("44444444-4444-4444-8444-444444444444", true, staleId),
  };
  for (const [name, command] of Object.entries(commands)) {
    await assert.rejects(command(), { name: "StaleCaptureError" }, name);
    assert.deepEqual((await h.store.read()).draft, current.draft, name);
    assert.equal((await h.db.query("SELECT * FROM outbox_event")).length, 0, name);
  }
});

void test("round 4: Edit on A cannot change B after both post-commit read failures and engine notifications", async () => {
  const h = await harness();
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await h.service.update({ step: "confirm" }, await currentEventId(h.store));
  let displayed = await h.service.read();
  assert.ok(displayed.draft);
  const displayedA = displayed.draft;
  let shouldFailRead = false;
  const snapshots = h.store.snapshots.bind(h.store);
  h.store.snapshots = () =>
    shouldFailRead ? Promise.reject(new Error("Post-commit snapshot read failed")) : snapshots();
  const pending: Promise<void>[] = [];
  let failedNotifications = 0;
  const refresh = async () => {
    displayed = h.service.draftBuffer.merge(await h.service.read());
  };
  const unsubscribe = observeCaptureUpdates({
    subscriptions: [h.engine.subscribe],
    invalidate: () => undefined,
    refresh: () => {
      const reading = refresh();
      pending.push(reading.catch(() => undefined));
      return reading;
    },
    setError: () => {
      failedNotifications++;
    },
  });
  await Promise.all(pending);
  const notices: string[] = [];
  const input = {
    service: h.service,
    buffer: h.service.draftBuffer,
    refresh,
    setError: (key: string | null) => {
      if (key) notices.push(key);
    },
  };
  const enqueue = h.outbox.enqueue.bind(h.outbox);
  h.outbox.enqueue = async (...args) => {
    await enqueue(...args);
    shouldFailRead = true;
  };
  assert.equal(
    await runCaptureAction(input, () => h.service.save(displayedA.eventId), {
      eventId: displayedA.eventId,
    }),
    false,
  );
  await h.engine.requestSync();
  await Promise.all(pending);
  assert.ok(failedNotifications > 0);
  const failedAfterSave = failedNotifications;
  assert.equal(displayed.event, null);
  shouldFailRead = false;
  const begin = h.store.begin.bind(h.store);
  h.store.begin = async (draft) => {
    await begin(draft);
    shouldFailRead = true;
  };
  assert.equal(
    await runCaptureAction(input, () => h.service.startPlace(displayedA.eventId), {
      eventId: displayedA.eventId,
      startsCapture: true,
    }),
    false,
  );
  const storedB = await h.store.read();
  assert.ok(storedB.draft);
  assert.equal(storedB.draft.mode, "place");
  assert.equal(storedB.draft.step, "point");
  assert.equal(storedB.draft.point, null);
  assert.equal(displayed.draft.eventId, displayedA.eventId);
  h.engine.setOnline(false);
  await Promise.all(pending);
  assert.ok(failedNotifications > failedAfterSave);
  assert.equal(displayed.draft.eventId, displayedA.eventId);
  shouldFailRead = false;
  h.service.draftBuffer.edit(storedB.draft.eventId, { temperature: "37" });
  const ok = await runCaptureAction(input, () => editConfirmation(h.service, displayedA), {
    eventId: displayedA.eventId,
  });
  assert.equal(ok, false);
  assert.equal(notices.at(-1), "mobile.ovitrap.staleView");
  assert.deepEqual(await h.store.read(), storedB);
  assert.equal(displayed.draft.eventId, storedB.draft.eventId);
  assert.equal(displayed.draft.step, "point");
  await assert.rejects(editConfirmation(h.service, displayedA), { name: "StaleCaptureError" });
  const restarted = await harness(h);
  const resumed = await restarted.service.startPlace(storedB.draft.eventId);
  assert.equal(resumed.draft?.step, "point");
  assert.equal(resumed.draft.point, null);
  unsubscribe();
  await h.engine.requestSync();
});

void test("round 5: Edit on A cannot flush B's failed buffered input after reading an old snapshot", async () => {
  const h = await harness();
  await h.service.startCheck(
    "44444444-4444-4444-8444-444444444444",
    true,
    await currentEventId(h.store),
  );
  await prepareCheck(h.service);
  await h.service.update({ step: "confirm" }, await currentEventId(h.store));
  const savedA = await h.service.save(await currentEventId(h.store));
  assert.ok(savedA.draft);
  const displayedA = savedA.draft;
  const entered = barrier();
  const release = barrier();
  const read = h.service.read.bind(h.service);
  let shouldPause = true;
  h.service.read = async () => {
    const snapshot = await read();
    if (shouldPause) {
      shouldPause = false;
      entered.resolve();
      await release.promise;
    }
    return snapshot;
  };
  const notices: string[] = [];
  const buffer = h.service.draftBuffer;
  const editing = runCaptureAction(
    {
      service: h.service,
      buffer,
      refresh: async () => {
        await h.service.read();
      },
      setError: (key: string | null) => {
        if (key) notices.push(key);
      },
    },
    () => editConfirmation(h.service, displayedA),
    { eventId: displayedA.eventId },
  );
  await entered.promise;
  const startedB = await h.service.startPlace(displayedA.eventId);
  assert.ok(startedB.draft);
  assert.notEqual(startedB.draft.eventId, displayedA.eventId);
  buffer.edit(startedB.draft.eventId, { temperature: "37" });
  const update = h.store.update.bind(h.store);
  h.store.update = () => Promise.reject(new Error("Storage write failed"));
  await assert.rejects(buffer.persist(h.service), /Storage write failed/);
  h.store.update = update;
  const storedB = await h.store.read();
  assert.equal(storedB.draft?.temperature, "");
  const outbox = await h.db.query("SELECT * FROM outbox_event");
  release.resolve();
  assert.equal(await editing, false);
  assert.equal(notices.at(-1), "mobile.ovitrap.staleView");
  assert.deepEqual(await h.store.read(), storedB);
  assert.deepEqual(await h.db.query("SELECT * FROM outbox_event"), outbox);
  assert.equal(buffer.merge(await h.service.read()).draft?.temperature, "37");
  await buffer.persist(h.service);
  assert.equal((await h.store.read()).draft?.temperature, "37");
  await h.engine.requestSync();
});
