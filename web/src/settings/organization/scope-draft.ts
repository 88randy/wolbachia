import type { Schemas } from "@wolbachia/api-client";
import type { ScopeDimensionName, ScopeDimensionUpdate } from "./scope-types";
export interface ScopeDraft {
  scope: Schemas["MeScope"];
  intents: Record<ScopeDimensionName, number>;
}
export type ScopeDraftAction =
  | { type: "change"; dimension: ScopeDimensionName; update: ScopeDimensionUpdate }
  | { type: "lookup"; dimension: ScopeDimensionName; expectedIntent: number; id: string };
export function createScopeDraft(scope: Schemas["MeScope"]): ScopeDraft {
  return { scope, intents: { centers: 0, quadrants: 0 } };
}
/** Every dimension mutation, including reset/no-op and accepted lookup, advances its intent. */
function mutateDimension(
  state: ScopeDraft,
  dimension: ScopeDimensionName,
  value: Schemas["ScopeDimension"],
): ScopeDraft {
  return {
    scope: { ...state.scope, [dimension]: value },
    intents: { ...state.intents, [dimension]: state.intents[dimension] + 1 },
  };
}
/** This is the only scope mutation boundary. Lookup validation and application are atomic. */
export function scopeDraftReducer(state: ScopeDraft, action: ScopeDraftAction): ScopeDraft {
  const current = state.scope[action.dimension];
  if (action.type === "change")
    return mutateDimension(state, action.dimension, action.update(current));
  if (current.mode !== "selected" || state.intents[action.dimension] !== action.expectedIntent)
    return state;
  const value = { ...current, ids: [...new Set([...current.ids, action.id])].sort() };
  return mutateDimension(state, action.dimension, value);
}
