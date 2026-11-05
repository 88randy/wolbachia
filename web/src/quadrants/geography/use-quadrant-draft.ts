import type { Schemas } from "@wolbachia/api-client";
import { polygonText } from "./geometry";
import type { GeographyScope } from "./use-w-15";
import { useGeographyWrite } from "./use-geography-write";
import { usePolygonDraftState } from "./use-polygon-draft-state";
import { useDraftValidation } from "./use-draft-validation";
import { publicationActions } from "./publication-actions";
interface Options {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
}
export function useQuadrantDraft({ scope, quadrant }: Options) {
  const state = usePolygonDraftState(quadrant, scope);
  const write = useGeographyWrite<Schemas["QuadrantWrite"]>();
  const validation = useDraftValidation({ scope, quadrant: quadrant.id, state, write });
  const draft = { ...state, write, ...validation };
  return {
    ...draft,
    ...publicationActions({ scope, quadrant, draft }),
    setText: (text: string) => {
      if (!write.isBusy) {
        state.setText(text);
        if (validation.hasAllBlockers) write.clear();
      }
    },
    discard: () => {
      state.setText(polygonText(quadrant.current_version?.geometry));
      state.setRevision(quadrant.current_version?.revision ?? 0);
      state.setResolutions({});
      if (validation.hasAllBlockers) write.clear();
    },
  };
}
export type QuadrantDraft = ReturnType<typeof useQuadrantDraft>;
