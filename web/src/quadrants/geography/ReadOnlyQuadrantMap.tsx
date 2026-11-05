import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { allPointsOptions, blocksOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
import { MapPanel } from "./MapPanel";
export function ReadOnlyQuadrantMap({
  scope,
  quadrant,
}: {
  scope: GeographyScope;
  quadrant: Schemas["Quadrant"];
}) {
  const points = useQuery(allPointsOptions(scope, quadrant.id));
  const blocks = useQuery(blocksOptions(scope, quadrant.id, 1));
  return (
    <MapPanel
      quadrants={[quadrant]}
      points={points.data ?? []}
      blocks={blocks.data?.results ?? []}
    />
  );
}
