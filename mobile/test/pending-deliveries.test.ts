import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countPendingDeliveries,
  pendingDeliveries,
} from "../src/features/supply-receipt/pending-deliveries.ts";
import { MIN_AUTO_REFRESH_GAP_MS, throttleRefresh } from "../src/features/day/refresh-throttle.ts";
import { receiptId, supplyAssignment } from "./support/m-05-fixtures.ts";

function assignment(patch: { date: string; shift: string | null; revision?: number }) {
  const base = supplyAssignment();
  const revision = patch.revision ?? base.revision;
  return {
    ...base,
    id: receiptId(Number(patch.date.replaceAll("-", "").slice(-4))),
    date: patch.date,
    shift_id: patch.shift,
    revision,
    receipts: [],
    releases: base.releases.map((release) => ({
      ...release,
      id: `${release.id}-${patch.date}`,
      plan_revision: revision,
    })),
  };
}
const SHIFT = "shift-today";

void test("the list and the count come from one query, newest first, current shift only", () => {
  const rows = [
    assignment({ date: "2026-10-14", shift: "shift-other" }),
    assignment({ date: "2026-11-11", shift: SHIFT }),
    assignment({ date: "2026-10-28", shift: null }),
  ];
  const list = pendingDeliveries(rows, SHIFT);
  assert.deepEqual(
    list.map((row) => row.assignment.date),
    ["2026-11-11", "2026-10-28"],
  );
  assert.equal(countPendingDeliveries(rows, SHIFT), list.length);
});

void test("a delivery already received or already started on the phone is not offered", () => {
  const [first] = pendingDeliveries([assignment({ date: "2026-11-11", shift: SHIFT })], SHIFT);
  assert.ok(first);
  const started = pendingDeliveries([assignment({ date: "2026-11-11", shift: SHIFT })], SHIFT, [
    first.release.id,
  ]);
  assert.equal(started.length, 0);
  const received = {
    ...first.assignment,
    receipts: [{ release_id: first.release.id, voided: false }],
  };
  assert.equal(countPendingDeliveries([received as never], SHIFT), 0);
});

void test("automatic refreshes are spaced out, the first one runs, and later ones run after the gap", async () => {
  let nowMs = 0;
  let runs = 0;
  const auto = throttleRefresh(
    () => {
      runs++;
      return Promise.resolve();
    },
    () => nowMs,
  );
  await auto();
  await auto();
  nowMs += MIN_AUTO_REFRESH_GAP_MS - 1;
  await auto();
  assert.equal(runs, 1);
  nowMs += 2;
  await auto();
  assert.equal(runs, 2);
});
