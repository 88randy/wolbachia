import { useReducer } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { createScopeDraft, scopeDraftReducer } from "./scope-draft";
import type { ScopeDraft, ScopeDraftAction } from "./scope-draft";
import type { ScopeDimensionEditor, ScopeDimensionName } from "./scope-types";
function bindDimension(
  state: ScopeDraft,
  dispatch: (action: ScopeDraftAction) => void,
  dimension: ScopeDimensionName,
): ScopeDimensionEditor {
  return {
    value: state.scope[dimension],
    intentRevision: state.intents[dimension],
    change: (update) => {
      dispatch({ type: "change", dimension, update });
    },
    applyLookup: (expectedIntent, id) => {
      dispatch({ type: "lookup", dimension, expectedIntent, id });
    },
  };
}
/** No raw setter: mode changes, removals and resets share the reducer's intent boundary. */
export function useScopeDimensions(initial: Schemas["MeScope"]) {
  const [state, dispatch] = useReducer(scopeDraftReducer, initial, createScopeDraft);
  return {
    scope: state.scope,
    centers: bindDimension(state, dispatch, "centers"),
    quadrants: bindDimension(state, dispatch, "quadrants"),
  };
}
