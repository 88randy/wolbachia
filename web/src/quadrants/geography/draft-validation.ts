import type { Schemas } from "@wolbachia/api-client";
import { containsLocation, resolutionPayload } from "./geometry";
import type { Polygon, ResolutionDraft } from "./geometry";
import { emptyResolution } from "./use-polygon-draft-state";
interface Options {
  points: Schemas["SamplingPoint"][];
  geometry: Polygon | null;
  blocked: string[];
  resolutions: Record<string, ResolutionDraft>;
}
export function excludedDecisions({ points, geometry, blocked, resolutions }: Options) {
  const excluded = points.filter((point) => isExcluded({ point, geometry, blocked }));
  const decisions = excluded.map((point) =>
    geometry
      ? resolutionPayload(resolutions[point.id] ?? emptyResolution(point.id), geometry)
      : null,
  );
  return { excluded, decisions };
}
function isExcluded({
  point,
  geometry,
  blocked,
}: Pick<Options, "geometry" | "blocked"> & { point: Schemas["SamplingPoint"] }) {
  const version = point.current_version;
  if (!version || version.is_retired) return false;
  return (
    blocked.includes(point.id) || Boolean(geometry && !containsLocation(geometry, version.location))
  );
}
