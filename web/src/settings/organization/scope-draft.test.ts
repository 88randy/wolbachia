import { expect, test } from "vitest";
import { createScopeDraft, scopeDraftReducer } from "./scope-draft";
import type { ScopeDimensionUpdate } from "./scope-types";
const INITIAL = {
  centers: { mode: "selected" as const, ids: ["A"] },
  quadrants: { mode: "all" as const, ids: [] },
};
const MUTATIONS: Record<string, ScopeDimensionUpdate> = {
  remove: (current) => ({ ...current, ids: current.ids.filter((id) => id !== "A") }),
  mode: () => ({ mode: "none", ids: [] }),
  reset: (current) => current,
};
test.each(Object.entries(MUTATIONS))(
  "%s invalidates all older lookups of that dimension, including a no-op reset",
  (_name, update) => {
    const initial = createScopeDraft(INITIAL);
    const changed = scopeDraftReducer(initial, { type: "change", dimension: "centers", update });
    const late = scopeDraftReducer(changed, {
      type: "lookup",
      dimension: "centers",
      expectedIntent: initial.intents.centers,
      id: "B",
    });
    expect(changed.intents.centers).toBe(1);
    expect(late).toEqual(changed);
  },
);
test("changing quadrants does not invalidate the independent center lookup", () => {
  const initial = createScopeDraft(INITIAL);
  const changed = scopeDraftReducer(initial, {
    type: "change",
    dimension: "quadrants",
    update: () => ({ mode: "none", ids: [] }),
  });
  const result = scopeDraftReducer(changed, {
    type: "lookup",
    dimension: "centers",
    expectedIntent: initial.intents.centers,
    id: "B",
  });
  expect(result.scope).toEqual({
    centers: { mode: "selected", ids: ["A", "B"] },
    quadrants: { mode: "none", ids: [] },
  });
  expect(result.intents).toEqual({ centers: 1, quadrants: 1 });
});
test("even an accepted duplicate lookup advances intent and invalidates sibling responses", () => {
  const initial = createScopeDraft(INITIAL);
  const accepted = scopeDraftReducer(initial, {
    type: "lookup",
    dimension: "centers",
    expectedIntent: 0,
    id: "A",
  });
  const late = scopeDraftReducer(accepted, {
    type: "lookup",
    dimension: "centers",
    expectedIntent: 0,
    id: "B",
  });
  expect(accepted.intents.centers).toBe(1);
  expect(late.scope.centers).toEqual({ mode: "selected", ids: ["A"] });
  expect(late.intents.centers).toBe(1);
});
