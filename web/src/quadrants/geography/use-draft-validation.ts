import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { allPointsOptions, blocksOptions } from "./geography-query";
import { parsePolygon } from "./geometry";
import type { GeographyScope } from "./use-w-15";
import type { useGeographyWrite } from "./use-geography-write";
import type { usePolygonDraftState } from "./use-polygon-draft-state";
import { useRetryWindow } from "./use-retry-window";
import { excludedDecisions } from "./draft-validation";
interface Options {
  scope: GeographyScope;
  quadrant: string;
  state: ReturnType<typeof usePolygonDraftState>;
  write: ReturnType<typeof useGeographyWrite<Schemas["QuadrantWrite"]>>;
}
export function useDraftValidation({ scope, quadrant, state, write }: Options) {
  const points = useQuery(allPointsOptions(scope, quadrant));
  const blocks = useQuery(blocksOptions(scope, quadrant, 1));
  const geometry = parsePolygon(state.text);
  const failure = write.outcome?.kind === "failed" ? write.outcome : null;
  const blocked = failure?.blocked ?? [];
  const validation = excludedDecisions({
    points: points.data ?? [],
    geometry,
    blocked,
    resolutions: state.resolutions,
  });
  const hasAllBlockers = blocked.every((id) => points.data?.some((point) => point.id === id));
  const isWaiting = useRetryWindow(write.retryAt);
  const canSubmit = isReady({
    hasGeometry: Boolean(geometry),
    hasPoints: points.isSuccess && !points.isFetching && hasAllBlockers,
    hasDecisions: validation.decisions.every(Boolean),
    isBusy: write.isBusy || isWaiting,
  });
  return { points, blocks, geometry, blocked, ...validation, isWaiting, canSubmit, hasAllBlockers };
}

function isReady(flags: {
  hasGeometry: boolean;
  hasPoints: boolean;
  hasDecisions: boolean;
  isBusy: boolean;
}) {
  return flags.hasGeometry && flags.hasPoints && flags.hasDecisions && !flags.isBusy;
}
