import { useContext, useEffect, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { polygonText } from "./geometry";
import type { ResolutionDraft } from "./geometry";
import type { GeographyScope } from "./use-w-15";
import { DraftMemory } from "./draft-memory";
export function usePolygonDraftState(quadrant: Schemas["Quadrant"], scope: GeographyScope) {
  const memory = useContext(DraftMemory);
  const retained = memory.current?.record.id === quadrant.id ? memory.current : null;
  const [text, setText] = useState(
    () => retained?.text ?? polygonText(quadrant.current_version?.geometry),
  );
  const [revision, setRevision] = useState(
    retained?.revision ?? quadrant.current_version?.revision ?? 0,
  );
  const [resolutions, setResolutions] = useState<Record<string, ResolutionDraft>>(() =>
    permittedResolutions(retained?.resolutions ?? {}, scope.canCreatePoint),
  );
  useEffect(() => {
    memory.current = { record: quadrant, text, revision, resolutions };
  }, [memory, quadrant, text, revision, resolutions]);
  return { text, setText, revision, setRevision, resolutions, setResolutions };
}
function permittedResolutions(
  resolutions: Record<string, ResolutionDraft>,
  canCreatePoint: boolean,
) {
  return Object.fromEntries(
    Object.entries(resolutions).filter(
      ([, resolution]) => canCreatePoint || resolution.decision === "keep",
    ),
  );
}
export function emptyResolution(point: string): ResolutionDraft {
  return { point, decision: "", evidence: "" };
}
