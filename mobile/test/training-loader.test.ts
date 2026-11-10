import assert from "node:assert/strict";
import { test } from "node:test";
import { TrainingLoader } from "../src/features/training/training-loader.ts";
import type { TrainingSource } from "../src/features/training/types.ts";

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
void test("P30 invalidation hides private feedback before deferred read and refuses the old completion", async () => {
  const source: TrainingSource = {
    eligibility: [],
    records: null,
    canReadTraining: true,
    canReadEvaluations: true,
    guard: { sql: "SELECT 1" },
  };
  const first = deferred<TrainingSource>(),
    replacement = deferred<TrainingSource>();
  let displayed: TrainingSource | null = source,
    reads = 0;
  const loader = new TrainingLoader({
    read: () => (++reads === 1 ? first.promise : replacement.promise),
    publish: (state) => {
      displayed = state.source;
    },
  });
  const pending = loader.read();
  assert.equal(displayed, null, "concealment precedes queued storage read");
  const next = loader.read();
  first.resolve(source);
  await pending;
  assert.equal(displayed, null, "prior identity's completion cannot reappear");
  loader.invalidate();
  replacement.resolve(source);
  await next;
  assert.equal(displayed, null, "unmounted/revoked reader cannot publish");
});
