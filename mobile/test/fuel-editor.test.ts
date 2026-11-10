import assert from "node:assert/strict";
import { test } from "node:test";
import { FuelEditBuffer, runFuelOperation } from "../src/features/fuel/edit-buffer.ts";
import type { FuelState } from "../src/features/fuel/types.ts";
import { deferred } from "./support/auth-fakes.ts";

function editorState(eventId: string): FuelState {
  return {
    ready: true,
    canBegin: true,
    draft: {
      eventId,
      ownerKey: "fuel-editor-owner",
      shiftId: "fuel-editor-shift",
      motorcycleCode: "M-03",
      deviceTime: "2026-11-09T15:00:00.000Z",
      catalogVersion: "catalog-editor",
      rulesVersion: "rules-editor",
      litres: "1",
      amount: "25",
      currency: "MXN",
      odometer: "12000",
      isFullRefill: false,
      receipt: null,
    },
    drafts: [],
    event: null,
    receiptPending: true,
    review: null,
    advisory: { kind: "insufficient", efficiencyKmL: null, minimum: null, maximum: null },
  };
}

void test("M11 failed edits stay visible and retry flushes a newer raw replacement before retake or Save", async () => {
  const buffer = new FuelEditBuffer();
  const original = editorState("fuel-editor-event");
  let savedLitres = "1",
    attempts = 0;
  const entered = deferred<undefined>(),
    release = deferred<undefined>();
  const operations: string[] = [];
  const operation = () => {
    operations.push(savedLitres);
    return Promise.resolve();
  };
  buffer.edit("litres", {
    eventId: "fuel-editor-event",
    apply: (draft) => ({ ...draft, litres: "4.500" }),
    write: async () => {
      if (++attempts === 1) throw new Error("Storage unavailable");
      entered.resolve(undefined);
      await release.promise;
      savedLitres = "4.500";
    },
  });
  await assert.rejects(
    runFuelOperation({ buffer, operation, shouldPersist: true }),
    /Storage unavailable/,
  );
  assert.equal(buffer.merge(original).draft?.litres, "4.500");
  assert.deepEqual(operations, []);
  const retry = runFuelOperation({ buffer, operation, shouldPersist: true });
  await entered.promise;
  buffer.edit("litres", {
    eventId: "fuel-editor-event",
    apply: (draft) => ({ ...draft, litres: "5.250" }),
    write: () => {
      savedLitres = "5.250";
      return Promise.resolve();
    },
  });
  assert.equal(buffer.merge(original).draft?.litres, "5.250");
  release.resolve(undefined);
  await retry;
  assert.deepEqual(operations, ["5.250"]);
  assert.equal(buffer.hasPending, false);
});

void test("M11 new-shift recovery retains failed old-draft input while the same new field persists independently", async () => {
  const buffer = new FuelEditBuffer();
  const oldState = editorState("old-shift-event");
  const newState = editorState("new-shift-event");
  const rejectOld = () => Promise.reject(new Error("shift"));
  buffer.edit("litres", {
    eventId: "old-shift-event",
    apply: (draft) => ({ ...draft, litres: "4.500" }),
    write: rejectOld,
  });
  await assert.rejects(
    runFuelOperation({
      buffer,
      eventId: "old-shift-event",
      shouldPersist: true,
      operation: () => Promise.resolve(),
    }),
    /shift/,
  );
  buffer.edit("litres", {
    eventId: "old-shift-event",
    apply: (draft) => ({ ...draft, litres: "5.250" }),
    write: rejectOld,
  });
  let begins = 0;
  await runFuelOperation({
    buffer,
    eventId: "old-shift-event",
    shouldPersist: false,
    operation: () => {
      begins++;
      return Promise.resolve();
    },
  });
  assert.equal(begins, 1);
  let savedNew = "1";
  buffer.edit("litres", {
    eventId: "new-shift-event",
    apply: (draft) => ({ ...draft, litres: "7.125" }),
    write: () => {
      savedNew = "7.125";
      return Promise.resolve();
    },
  });
  await runFuelOperation({
    buffer,
    eventId: "new-shift-event",
    shouldPersist: true,
    operation: () => {
      assert.equal(savedNew, "7.125");
      return Promise.resolve();
    },
  });
  assert.equal(buffer.merge(oldState).draft?.litres, "5.250");
  assert.equal(buffer.merge(newState).draft?.litres, "1");
  assert.equal(buffer.hasPendingFor("old-shift-event"), true);
  assert.equal(buffer.hasPendingFor("new-shift-event"), false);
  assert.equal(buffer.hasPending, true);
});
