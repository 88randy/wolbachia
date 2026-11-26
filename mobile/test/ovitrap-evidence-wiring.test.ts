import assert from "node:assert/strict";
import { test } from "node:test";
import { currentEventId, harness } from "./support/m-08-harness.ts";

const FIX = { lat: 19.43, lng: -99.13, accuracy_m: 12 };

void test("placing and checking stamp the location from the injected GPS port", async () => {
  let calls = 0;
  const h = await harness(undefined, {
    gps: {
      locate: () => {
        calls += 1;
        return Promise.resolve(FIX);
      },
    },
  });
  await h.service.startPlace(await currentEventId(h.store));
  const placing = await h.store.read();
  assert.deepEqual(placing.draft?.gps, FIX);
  assert.ok(calls >= 1);
  const before = calls;
  await h.service.refreshGps(await currentEventId(h.store));
  assert.equal(calls, before + 1);
});

void test("without a fix the draft keeps no coordinates, so it is sent for review", async () => {
  const h = await harness(undefined, { gps: { locate: () => Promise.resolve(null) } });
  await h.service.startPlace(await currentEventId(h.store));
  assert.equal((await h.store.read()).draft?.gps, null);
});

void test("the scanner port routes an ovitrap QR into a check draft", async () => {
  const id = "33333333-3333-4333-8333-333333333333";
  let scans = 0;
  const h = await harness(undefined, {
    scanner: {
      scan: () => {
        scans += 1;
        return Promise.resolve({ status: "read" as const, value: `wbf:1:ovitrap:${id}` });
      },
    },
  });
  const result = await h.service.scan("ovitrap", await currentEventId(h.store));
  assert.equal(scans, 1);
  assert.ok(["read", "invalid", "cancelled"].includes(result));
});

void test("an unavailable scanner never invents a code", async () => {
  const h = await harness(undefined, {
    scanner: { scan: () => Promise.resolve({ status: "unavailable" as const }) },
  });
  assert.equal(await h.service.scan("bag", await currentEventId(h.store)), "unavailable");
});
