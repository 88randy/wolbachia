import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { centersOptions } from "../../centers/centers-query";
import type { GeographyScope } from "../geography/use-w-15";
import {
  editorBlocksOptions,
  editorPermitsOptions,
  editorPointsOptions,
  editorQuadrantsOptions,
  editorReleasePointsOptions,
} from "./editor-query";

const EMPTY: never[] = [];

/** Everything the editor draws. Previous data stays on screen while it refetches. */
export function useEditorData(scope: GeographyScope) {
  const quadrants = useQuery(editorQuadrantsOptions(scope));
  const blocks = useQuery(editorBlocksOptions(scope));
  const points = useQuery(editorPointsOptions(scope));
  const releasePoints = useQuery(editorReleasePointsOptions(scope));
  const permits = useQuery({ ...editorPermitsOptions(scope), retry: false });
  const centers = useQuery(centersOptions(scope.client, scope.identity));
  const activePoints = useMemo(
    () =>
      (points.data ?? (EMPTY as Schemas["SamplingPoint"][])).filter(
        (item) => item.current_version && !item.current_version.is_retired,
      ),
    [points.data],
  );
  return {
    isLoading: quadrants.isPending,
    isError: quadrants.isError,
    refetch: () => void quadrants.refetch(),
    quadrants: quadrants.data ?? EMPTY,
    blocks: blocks.data ?? EMPTY,
    points: activePoints,
    releasePoints: releasePoints.data ?? EMPTY,
    permits: permits.data ?? EMPTY,
    canCheckPermits: permits.isSuccess,
    centers: centers.data ?? EMPTY,
  };
}

export type EditorData = ReturnType<typeof useEditorData>;
