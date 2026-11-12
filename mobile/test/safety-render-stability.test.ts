import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INITIAL_SAFETY,
  isSameSafety,
  observeSafety,
  readSafetyRules,
} from "../src/features/safety/domain.ts";
import type { SafetySample, SafetyState } from "../src/features/safety/domain.ts";

const RULES = readSafetyRules(null);

/** What the one-second tick of the safety monitor does with React state. */
function tick(previous: SafetyState, sample: SafetySample | null, nowMs: number): SafetyState {
  const next = observeSafety({ state: previous, sample, nowMs, rules: RULES });
  return isSameSafety(previous, next) ? previous : next;
}

void test("the lock and PIN screens are not re-rendered by a tick that changes nothing", () => {
  let state = INITIAL_SAFETY;
  let renders = 0;
  for (let second = 0; second < 30; second++) {
    const next = tick(state, null, 1_000_000 + second * 1000);
    if (next !== state) renders++;
    state = next;
  }
  // Without a fix the state never changes, so React keeps the same reference after the first tick.
  assert.equal(renders, 0);
});

void test("a fresh sample object with the same values does not count as a change", () => {
  const first: SafetySample = { atMs: 5000, speedMps: 0, accuracyM: 20 };
  let state = tick(INITIAL_SAFETY, first, 6000);
  const reference = state;
  state = tick(state, { ...first }, 6000);
  assert.equal(state, reference);
});

void test("a real change (a new fix, a different quality) is still published", () => {
  const first: SafetySample = { atMs: 5000, speedMps: 0, accuracyM: 20 };
  const state = tick(INITIAL_SAFETY, first, 6000);
  const moved = tick(state, { atMs: 7000, speedMps: 1, accuracyM: 20 }, 7000);
  assert.notEqual(moved, state);
  assert.ok(!isSameSafety(state, moved));
});
