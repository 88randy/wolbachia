import { useQuery } from "@tanstack/react-query";
import { allPointsOptions, blocksOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";

const MAX_BLOCKS = 200;

/** Human codes for point and block ids of one quadrant. Unknown ids show a dash, never the id. */
export function useGeographyCodes(scope: GeographyScope, quadrant: string) {
  const points = useQuery(allPointsOptions(scope, quadrant));
  const blocks = useQuery(blocksOptions(scope, quadrant, MAX_BLOCKS));
  const pointCodes = new Map((points.data ?? []).map((item) => [item.id, item.code]));
  const blockCodes = new Map((blocks.data?.results ?? []).map((item) => [item.id, item.code]));
  return {
    point: (id: string) => pointCodes.get(id) ?? "—",
    block: (id: string) => blockCodes.get(id) ?? "—",
  };
}
