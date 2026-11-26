import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { allPointsOptions, blocksOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";

const MAX_BLOCKS = 200;

/**
 * Human codes for point and block ids of one quadrant. Unknown ids show a dash, never the id.
 * The lookups only change when the data does: the table columns depend on them, and a column list
 * rebuilt on every render would remount every cell (and drop the focus inside the list).
 */
export function useGeographyCodes(scope: GeographyScope, quadrant: string) {
  const points = useQuery(allPointsOptions(scope, quadrant));
  const blocks = useQuery(blocksOptions(scope, quadrant, { page: 1, pageSize: MAX_BLOCKS }));
  const pointData = points.data;
  const blockData = blocks.data;
  return useMemo(() => {
    const pointCodes = new Map((pointData ?? []).map((item) => [item.id, item.code]));
    const blockCodes = new Map((blockData?.results ?? []).map((item) => [item.id, item.code]));
    return {
      point: (id: string) => pointCodes.get(id) ?? "—",
      block: (id: string) => blockCodes.get(id) ?? "—",
    };
  }, [pointData, blockData]);
}
