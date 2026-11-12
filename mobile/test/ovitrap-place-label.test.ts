import assert from "node:assert/strict";
import { test } from "node:test";
import {
  capturePages,
  detailPages,
  isPageDone,
} from "../src/features/ovitrap-check/capture-pages.ts";
import { locationStatus } from "../src/features/ovitrap-check/location-status.ts";
import { currentEventId, harness } from "./support/m-08-harness.ts";

const FREE_ID = "66666666-6666-4666-8666-666666666666";
const LABEL = `wbf:1:ovitrap:${FREE_ID}`;
const TAKEN = "wbf:1:ovitrap:44444444-4444-4444-8444-444444444444";

void test("placing asks for the label before the photo, then the preparation", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const draft = (await h.store.read()).draft;
  assert.ok(draft);
  assert.deepEqual(capturePages(draft), ["point", "label", "photo", "prepare", "confirm"]);
  assert.deepEqual(detailPages(draft), ["label", "photo"]);
  assert.equal(isPageDone(draft, "label"), false);
  assert.equal(isPageDone(draft, "photo"), false);
  const photo = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", fileRef: "file:///p.jpg" };
  assert.equal(isPageDone({ ...draft, evidence: [photo] }, "photo"), true);
});

void test("a scanned label becomes the ovitrap identity of the placement", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.equal(await h.service.bindLabel(LABEL, false, eventId), "read");
  const draft = (await h.store.read()).draft;
  assert.equal(draft?.ovitrapId, FREE_ID);
  assert.equal(draft?.labelScanned, true);
  assert.equal(draft && isPageDone(draft, "label"), true);
});

void test("a label that is not an ovitrap QR is refused and changes nothing", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const before = (await h.store.read()).draft?.ovitrapId;
  const eventId = await currentEventId(h.store);
  assert.equal(
    await h.service.bindLabel("wbf:1:bag:44444444-4444-4444-8444-444444444444", false, eventId),
    "invalid",
  );
  assert.equal(await h.service.bindLabel("hello", false, eventId), "invalid");
  assert.equal((await h.store.read()).draft?.ovitrapId, before);
});

void test("a manual UUID works as the label when the sticker is damaged", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const id = "55555555-5555-4555-8555-555555555599";
  assert.equal(await h.service.bindLabel(id, true, await currentEventId(h.store)), "read");
  const draft = (await h.store.read()).draft;
  assert.equal(draft?.ovitrapId, id);
  assert.equal(draft?.manualCapture, true);
});

void test("the location line: searching, ready with accuracy, and missing after the wait", () => {
  assert.deepEqual(locationStatus({ kind: "searching" }), {
    kind: "searching",
    accuracyM: null,
  });
  const fix = { lat: 19, lng: -99, accuracy_m: 25, fixedAt: 1 };
  assert.deepEqual(locationStatus({ kind: "granted", fix }), {
    kind: "ready",
    accuracyM: 25,
  });
  assert.deepEqual(locationStatus({ kind: "noFix" }), { kind: "missing" });
  assert.deepEqual(locationStatus({ kind: "denied" }), { kind: "missing" });
  assert.deepEqual(locationStatus({ kind: "off" }), { kind: "missing" });
});

void test("a label that already belongs to a downloaded ovitrap is refused", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.equal(await h.service.bindLabel(TAKEN, false, eventId), "used");
});
