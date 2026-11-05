import type { Dispatch, SetStateAction } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import type { Polygon, ResolutionDraft } from "./geometry";
import type { useGeographyWrite } from "./use-geography-write";
interface PublicationDraft {
  geometry: Polygon | null;
  canSubmit: boolean;
  revision: number;
  decisions: (Schemas["PointResolutionRequest"] | null)[];
  setRevision: Dispatch<SetStateAction<number>>;
  setResolutions: Dispatch<SetStateAction<Record<string, ResolutionDraft>>>;
  write: ReturnType<typeof useGeographyWrite<Schemas["QuadrantWrite"]>>;
}
interface Options {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
  draft: PublicationDraft;
}
/** Explicit publication sends only the current excluded set, never omitted/extra point decisions. */
export function publicationActions({ scope, quadrant, draft }: Options) {
  return {
    publish: async () => {
      if (!draft.geometry || !draft.canSubmit) return;
      const body = {
        geometry: draft.geometry,
        expected_revision: draft.revision,
        point_resolutions: draft.decisions.filter(
          (decision): decision is Schemas["PointResolutionRequest"] => decision !== null,
        ),
      };
      const result = await draft.write.execute((signal) =>
        scope.client.POST("/api/v1/quadrants/{id}/versions/", {
          params: { path: { id: quadrant.id } },
          body,
          signal,
        }),
      );
      if (result.kind === "saved") {
        draft.setRevision(result.value.version.revision);
        draft.setResolutions({});
      }
    },
  };
}
